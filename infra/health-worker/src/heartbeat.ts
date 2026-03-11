import type { Env, CheckStatus } from './types';
import { HEARTBEAT_ENDPOINTS, HEARTBEAT_TIMEOUT_MS } from './config';
import { checkEndpoint } from './check';
import { getHealthStatuses, upsertHealthStatus, insertHealthChecks } from './db';
import { sendBark } from './notify';
import { triggerRemediation } from './remediate';

/** Run heartbeat checks every 5 minutes */
export async function runHeartbeat(env: Env): Promise<void> {
  const batchId = new Date().toISOString().slice(0, 16);

  // Run all 3 checks in parallel
  const results = await Promise.all(
    HEARTBEAT_ENDPOINTS.map((ep) => {
      const baseUrl = ep.path === '/' ? env.FRONTEND_URL : env.API_BASE_URL;
      const url = ep.path === '/' ? baseUrl : `${baseUrl}${ep.path}`;
      const method = ep.method || 'GET';

      return checkEndpoint({
        url,
        path: ep.path,
        description: ep.description,
        roleCode: ep.role_code,
        method,
        body: ep.path === '/api/auth/login'
          ? JSON.stringify({ username: env.HEALTH_ADMIN_USER, password: env.HEALTH_ADMIN_PASS })
          : undefined,
        timeoutMs: HEARTBEAT_TIMEOUT_MS,
      });
    }),
  );

  // Get previous statuses
  const endpoints = results.map((r) => r.endpoint);
  const oldStatuses = await getHealthStatuses(env, endpoints);

  // Process each result: compare, upsert, notify
  for (const result of results) {
    const old = oldStatuses.get(result.endpoint);
    const oldStatus: CheckStatus = old?.status ?? 'ok';
    const oldFailures = old?.consecutive_failures ?? 0;

    const newStatus = result.status;
    const newFailures = newStatus === 'ok' ? 0 : oldFailures + 1;
    const stateChanged = oldStatus !== newStatus;

    // Upsert status
    await upsertHealthStatus(env, result.endpoint, newStatus, newFailures, result.error_message, stateChanged);

    // Notify on state change
    if (oldStatus === 'ok' && newStatus !== 'ok') {
      await sendBark(env, '⚠️ 服务异常', `${result.description} (${result.endpoint}) 无响应: ${result.error_message}`, 'alert');
    } else if (oldStatus !== 'ok' && newStatus === 'ok') {
      await sendBark(env, '✅ 服务恢复', `${result.description} (${result.endpoint}) 已恢复正常`, 'alert');
    } else if (newFailures >= 3 && newFailures % 3 === 0) {
      await sendBark(env, '🔴 紧急', `${result.description} (${result.endpoint}) 已连续 ${newFailures * 5} 分钟无响应`, 'alarm');
    }

    // Trigger auto-remediation on first threshold hit (3 consecutive failures)
    if (newFailures === 3 && env.GITHUB_TOKEN) {
      await triggerRemediation(env, {
        endpoint: result.endpoint,
        error_message: result.error_message ?? 'Unknown error',
        http_status: result.http_status,
        consecutive_failures: newFailures,
        trigger_type: 'heartbeat',
      });
    }
  }

  // Write check records
  await insertHealthChecks(env, results, 'heartbeat', batchId);
}
