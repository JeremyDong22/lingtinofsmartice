import type { Env, CheckResult } from './types';
import { PATROL_ENDPOINTS, PATROL_TIMEOUT_MS } from './config';
import { checkEndpoint } from './check';
import { insertHealthChecks } from './db';
import { sendBark } from './notify';

/** Login with credentials and return JWT token */
async function login(
  env: Env,
  username: string,
  password: string,
): Promise<{ token: string | null; error: string | null }> {
  try {
    const resp = await fetch(`${env.API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!resp.ok) {
      return { token: null, error: `Login failed: HTTP ${resp.status}` };
    }

    const data = (await resp.json()) as { access_token?: string };
    if (!data.access_token) {
      return { token: null, error: 'Login response missing access_token' };
    }

    return { token: data.access_token, error: null };
  } catch (err) {
    return { token: null, error: `Login error: ${String(err)}` };
  }
}

/** Run full patrol check at 09:00 and 15:00 CST */
export async function runPatrol(env: Env): Promise<void> {
  const batchId = new Date().toISOString().slice(0, 16);
  const allResults: CheckResult[] = [];

  // Step 1: Login with all 3 test accounts in parallel
  const roleCredentials = [
    { role: 'administrator', username: env.HEALTH_ADMIN_USER, password: env.HEALTH_ADMIN_PASS },
    { role: 'manager', username: env.HEALTH_MANAGER_USER, password: env.HEALTH_MANAGER_PASS },
    { role: 'chef', username: env.HEALTH_CHEF_USER, password: env.HEALTH_CHEF_PASS },
  ];

  const tokens = new Map<string, string | null>();
  const loginFailures: string[] = [];

  await Promise.all(
    roleCredentials.map(async ({ role, username, password }) => {
      const result = await login(env, username, password);
      tokens.set(role, result.token);
      if (!result.token) {
        loginFailures.push(`${role}: ${result.error}`);
      }
    }),
  );

  if (loginFailures.length > 0) {
    await sendBark(env, '⚠️ 巡检登录失败', loginFailures.join('\n'), 'alert');
  }

  // Step 2: Check all endpoints in parallel
  const checkPromises: Promise<CheckResult>[] = [];

  for (const ep of PATROL_ENDPOINTS) {
    const roleCode = ep.role_code;

    if (roleCode !== 'system' && !tokens.get(roleCode)) {
      allResults.push({
        endpoint: ep.path,
        description: ep.description,
        role_code: roleCode,
        status: 'fail',
        response_ms: 0,
        http_status: null,
        error_message: `Skipped: ${roleCode} login failed`,
      });
      continue;
    }

    const token = roleCode === 'system' ? null : tokens.get(roleCode) ?? null;
    checkPromises.push(
      checkEndpoint({
        url: `${env.API_BASE_URL}${ep.path}`,
        path: ep.path,
        description: ep.description,
        roleCode,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        timeoutMs: PATROL_TIMEOUT_MS,
      }),
    );
  }

  const checkResults = await Promise.all(checkPromises);
  allResults.push(...checkResults);

  // Step 3: Write all results to DB
  await insertHealthChecks(env, allResults, 'patrol', batchId);

  // Step 4: Notify if any failures
  const failures = allResults.filter((r) => r.status !== 'ok');

  if (failures.length > 0) {
    const total = allResults.length;
    const failCount = failures.length;
    const details = failures
      .slice(0, 5)
      .map((f) => `${f.endpoint} (${f.http_status ?? f.error_message})`)
      .join(', ');
    const suffix = failCount > 5 ? ` +${failCount - 5}项` : '';

    await sendBark(env, '⚠️ 巡检告警', `${failCount}/${total} 项失败：${details}${suffix}`, 'alert');
  }
}
