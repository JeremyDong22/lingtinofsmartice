import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import {
  createIncident,
  updateIncident,
  getRecentHealthErrors,
} from './supabase-client.js';
import { checkSafety, checkSeverityAllowed, getLimitsForSeverity, isValidSeverity } from './safety.js';
import { diagnose } from './diagnose.js';
import { applyFix, verifyBuild, pushAndCreatePR, autoMergePR, revertLastCommit } from './fix-generator.js';
import { verifyEndpoint, waitForDeployment } from './verify.js';
import { sendBark } from './notify.js';

interface TriggerPayload {
  endpoint: string;
  error_message: string;
  http_status: number | null;
  consecutive_failures: number;
  trigger_type: string;
}

async function main(): Promise<void> {
  // Read payload from file (safer than env var for untrusted content)
  const payloadFile = process.env.REMEDIATION_PAYLOAD_FILE;
  const payloadStr = payloadFile
    ? readFileSync(payloadFile, 'utf-8')
    : process.env.REMEDIATION_PAYLOAD;

  if (!payloadStr) {
    console.error('REMEDIATION_PAYLOAD_FILE or REMEDIATION_PAYLOAD is required');
    process.exit(1);
  }

  const payload: TriggerPayload = JSON.parse(payloadStr);
  console.log(`\n=== Auto-Remediation: ${payload.endpoint} ===`);
  console.log(`Error: ${payload.error_message} (HTTP ${payload.http_status})`);
  console.log(`Consecutive failures: ${payload.consecutive_failures}`);

  // 1. Safety checks (rate limits, cooldowns) — also returns config for reuse
  const safety = await checkSafety(payload.endpoint);
  if (!safety.allowed) {
    console.log(`⏭️  Skipped: ${safety.reason}`);
    await createIncident({
      endpoint: payload.endpoint,
      trigger_type: payload.trigger_type,
      error_message: payload.error_message,
      http_status: payload.http_status,
    }).then((id) => updateIncident(id, { status: 'skipped', diagnosis: safety.reason }));
    return;
  }

  const config = safety.config!;

  // 2. Create incident record
  const incidentId = await createIncident({
    endpoint: payload.endpoint,
    trigger_type: payload.trigger_type,
    error_message: payload.error_message,
    http_status: payload.http_status,
  });
  console.log(`📋 Incident: ${incidentId}`);

  try {
    // 3. Diagnose with AI
    await updateIncident(incidentId, { status: 'diagnosing' });
    console.log('🔍 Diagnosing...');

    const recentErrors = await getRecentHealthErrors(payload.endpoint);
    const result = await diagnose(
      payload.endpoint,
      payload.error_message,
      payload.http_status,
      recentErrors,
    );

    // Validate severity from AI response
    const severity = isValidSeverity(result.severity) ? result.severity : 'moderate';

    await updateIncident(incidentId, {
      diagnosis: result.diagnosis,
      root_cause: result.root_cause,
      severity,
    });

    console.log(`Diagnosis: ${result.diagnosis}`);
    console.log(`Root cause: ${result.root_cause}`);
    console.log(`Severity: ${severity}`);
    console.log(`Action: ${result.action}`);

    // 4. Escalate if AI can't fix
    if (result.action === 'escalate') {
      await updateIncident(incidentId, { status: 'escalated' });
      await sendBark(
        '🔔 需要人工介入',
        `${payload.endpoint}: ${result.diagnosis.slice(0, 100)}`,
        'alarm',
      );
      console.log('⬆️  Escalated to human');
      return;
    }

    if (!result.files_to_modify?.length) {
      await updateIncident(incidentId, { status: 'escalated', diagnosis: 'AI returned fix action but no files to modify' });
      await sendBark('🔔 需要人工介入', `${payload.endpoint}: AI 未生成修复代码`, 'alarm');
      return;
    }

    // 4b. Check severity against endpoint config ceiling
    const severityCheck = checkSeverityAllowed(config, severity);
    if (!severityCheck.allowed) {
      await updateIncident(incidentId, { status: 'escalated', diagnosis: severityCheck.reason });
      await sendBark('🔔 需要人工介入', `${payload.endpoint}: ${severityCheck.reason}`, 'alarm');
      console.log(`⬆️  Escalated: ${severityCheck.reason}`);
      return;
    }

    const limits = getLimitsForSeverity(severity);
    console.log(`📏 Severity "${severity}": max ${limits.maxFiles} files, ${limits.maxDiffLines} lines`);

    // 5. Apply fix
    await updateIncident(incidentId, { status: 'fixing' });
    console.log('🔧 Applying fix...');

    const fixResult = applyFix(incidentId, result.files_to_modify, severity);
    if (!fixResult.success) {
      await updateIncident(incidentId, { status: 'failed', fix_diff: fixResult.error });
      await sendBark('❌ 自动修复失败', `${payload.endpoint}: ${fixResult.error?.slice(0, 100)}`, 'alarm');
      return;
    }

    await updateIncident(incidentId, {
      fix_branch: fixResult.branch,
      fix_diff: fixResult.diff.slice(0, 10000),
    });

    // 6. Build check
    console.log('🏗️  Verifying build...');
    const buildResult = verifyBuild();
    if (!buildResult.success) {
      await updateIncident(incidentId, { status: 'failed', diagnosis: `Build failed: ${buildResult.error}` });
      await sendBark('❌ 编译失败', `${payload.endpoint}: 自动修复代码编译不通过`, 'alarm');
      try {
        execFileSync('git', ['checkout', 'main'], { stdio: 'pipe' });
        execFileSync('git', ['branch', '-D', fixResult.branch], { stdio: 'pipe' });
      } catch { /* best effort */ }
      return;
    }

    // 7. Push & Create PR
    console.log('📤 Creating PR...');
    const prResult = pushAndCreatePR(
      fixResult.branch,
      incidentId,
      result.diagnosis,
      fixResult.diff,
    );

    if (prResult.prNumber) {
      await updateIncident(incidentId, { fix_pr_number: prResult.prNumber });
      console.log(`PR #${prResult.prNumber} created`);
    } else {
      await updateIncident(incidentId, { status: 'failed', diagnosis: `PR creation failed: ${prResult.error}` });
      await sendBark('❌ PR 创建失败', `${payload.endpoint}: ${prResult.error?.slice(0, 100)}`, 'alarm');
      return;
    }

    // 8. Auto-merge (if configured AND severity allows)
    const canAutoMerge = config.auto_merge_allowed && limits.autoMergeEligible;
    if (canAutoMerge && prResult.prNumber) {
      await updateIncident(incidentId, { status: 'deploying' });
      console.log('🔀 Auto-merging...');

      const merged = autoMergePR(prResult.prNumber);
      if (!merged) {
        await updateIncident(incidentId, { status: 'failed', diagnosis: 'Auto-merge failed' });
        await sendBark('⚠️ 自动合并失败', `PR #${prResult.prNumber} 需要手动合并`, 'alert');
        return;
      }

      await updateIncident(incidentId, { was_auto_merged: true });

      // 9. Wait for deployment and verify
      await updateIncident(incidentId, { status: 'verifying' });
      await waitForDeployment();

      const apiBaseUrl = process.env.API_BASE_URL ?? 'https://lingtinapi.preview.aliyun-zeabur.cn';
      const verification = await verifyEndpoint(apiBaseUrl, payload.endpoint);

      await updateIncident(incidentId, {
        verification_status: verification.ok ? 'ok' : 'fail',
      });

      if (verification.ok) {
        await updateIncident(incidentId, { status: 'resolved' });
        await sendBark('✅ 自动修复成功', `${payload.endpoint} 已自动修复并部署`, 'alert');
        console.log('✅ Fix verified and deployed!');
      } else {
        // 10. Auto-rollback
        console.log('❌ Verification failed, rolling back...');
        const rollbackSha = revertLastCommit();
        await updateIncident(incidentId, {
          status: 'failed',
          verification_status: 'fail',
          rollback_commit: rollbackSha,
        });
        await sendBark(
          '🔙 自动回滚',
          `${payload.endpoint}: 修复后验证失败，已自动回滚。需要人工介入`,
          'alarm',
        );
      }
    } else {
      // No auto-merge: just notify about the PR
      await updateIncident(incidentId, { status: 'fixing' });
      await sendBark(
        '🔧 自动修复 PR 已创建',
        `${payload.endpoint}: PR #${prResult.prNumber} 待审核合并`,
        'alert',
      );
      console.log(`PR #${prResult.prNumber} created, awaiting manual review`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Remediation failed:', errorMsg);
    await updateIncident(incidentId, { status: 'failed', diagnosis: `Unexpected error: ${errorMsg}` });
    await sendBark('❌ 修复流程异常', `${payload.endpoint}: ${errorMsg.slice(0, 100)}`, 'alarm');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
