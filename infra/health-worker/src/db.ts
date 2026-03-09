import type { Env, CheckResult, HealthStatus } from './types';

const SUPABASE_HEADERS = (env: Env) => ({
  apikey: env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
});

/** Fetch current health status for given endpoints */
export async function getHealthStatuses(
  env: Env,
  endpoints: string[],
): Promise<Map<string, HealthStatus>> {
  const filter = endpoints.map((e) => `"${e}"`).join(',');
  const url =
    `${env.SUPABASE_URL}/rest/v1/lingtin_health_status` +
    `?endpoint=in.(${encodeURIComponent(filter)})` +
    `&select=endpoint,status,consecutive_failures,last_checked_at,last_changed_at,last_error`;

  const resp = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!resp.ok) {
    console.error(`Failed to fetch health statuses: ${resp.status}`);
    return new Map<string, HealthStatus>();
  }

  const rows: HealthStatus[] = await resp.json();
  const map = new Map<string, HealthStatus>();
  for (const row of rows) {
    map.set(row.endpoint, row);
  }
  return map;
}

/** Upsert health status (on conflict: endpoint) */
export async function upsertHealthStatus(
  env: Env,
  endpoint: string,
  status: string,
  consecutiveFailures: number,
  error: string | null,
  stateChanged: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    endpoint,
    status,
    consecutive_failures: consecutiveFailures,
    last_checked_at: now,
    last_error: error,
  };
  if (stateChanged) {
    body.last_changed_at = now;
  }

  const url =
    `${env.SUPABASE_URL}/rest/v1/lingtin_health_status` +
    `?on_conflict=endpoint`;

  await fetch(url, {
    method: 'POST',
    headers: {
      ...SUPABASE_HEADERS(env),
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(body),
  });
}

/** Insert check results into lingtin_health_checks */
export async function insertHealthChecks(
  env: Env,
  results: CheckResult[],
  checkType: 'heartbeat' | 'patrol',
  batchId: string,
): Promise<void> {
  const rows = results.map((r) => ({
    check_type: checkType,
    batch_id: batchId,
    endpoint: r.endpoint,
    role_code: r.role_code,
    status: r.status,
    response_ms: r.response_ms,
    http_status: r.http_status,
    error_message: r.error_message,
  }));

  await fetch(`${env.SUPABASE_URL}/rest/v1/lingtin_health_checks`, {
    method: 'POST',
    headers: SUPABASE_HEADERS(env),
    body: JSON.stringify(rows),
  });
}
