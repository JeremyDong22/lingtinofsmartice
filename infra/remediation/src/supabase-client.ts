import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
  }
  return client;
}

export interface RemediationIncident {
  id: string;
  endpoint: string;
  trigger_type: string;
  error_message: string | null;
  http_status: number | null;
  diagnosis: string | null;
  root_cause: string | null;
  fix_branch: string | null;
  fix_pr_number: number | null;
  fix_diff: string | null;
  severity: string | null;
  status: string;
  verification_status: string | null;
  was_auto_merged: boolean;
  rollback_commit: string | null;
  created_at: string;
  updated_at: string;
}

export interface RemediationConfig {
  endpoint: string;
  auto_fix_enabled: boolean;
  max_attempts_per_day: number;
  auto_merge_allowed: boolean;
  cooldown_minutes: number;
  max_severity: 'minor' | 'moderate' | 'major';
}

/** Create a new incident record and return its ID */
export async function createIncident(data: {
  endpoint: string;
  trigger_type: string;
  error_message: string;
  http_status: number | null;
}): Promise<string> {
  const sb = getSupabase();
  const { data: row, error } = await sb
    .from('lingtin_remediation_incidents')
    .insert({
      endpoint: data.endpoint,
      trigger_type: data.trigger_type,
      error_message: data.error_message,
      http_status: data.http_status,
      status: 'triggered',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create incident: ${error.message}`);
  return row.id;
}

/** Update an incident's status and optional fields */
export async function updateIncident(
  id: string,
  updates: Partial<Pick<
    RemediationIncident,
    'status' | 'severity' | 'diagnosis' | 'root_cause' | 'fix_branch' | 'fix_pr_number' |
    'fix_diff' | 'verification_status' | 'was_auto_merged' | 'rollback_commit'
  >>,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('lingtin_remediation_incidents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to update incident ${id}: ${error.message}`);
}

/** Get config for an endpoint (or defaults) */
export async function getEndpointConfig(endpoint: string): Promise<RemediationConfig> {
  const sb = getSupabase();
  const { data } = await sb
    .from('lingtin_remediation_config')
    .select('*')
    .eq('endpoint', endpoint)
    .single();

  return data ?? {
    endpoint,
    auto_fix_enabled: true,
    max_attempts_per_day: 3,
    auto_merge_allowed: false,
    cooldown_minutes: 30,
    max_severity: 'moderate' as const,
  };
}

/** Count today's incidents for an endpoint */
export async function countTodayAttempts(endpoint: string): Promise<number> {
  const sb = getSupabase();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count } = await sb
    .from('lingtin_remediation_incidents')
    .select('*', { count: 'exact', head: true })
    .eq('endpoint', endpoint)
    .gte('created_at', todayStart.toISOString());

  return count ?? 0;
}

/** Get the most recent incident for an endpoint */
export async function getLastIncident(endpoint: string): Promise<RemediationIncident | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from('lingtin_remediation_incidents')
    .select('*')
    .eq('endpoint', endpoint)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

/** Count all incidents today (global) */
export async function countTodayGlobalAttempts(): Promise<number> {
  const sb = getSupabase();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count } = await sb
    .from('lingtin_remediation_incidents')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString());

  return count ?? 0;
}

/** Fetch recent health check errors for context */
export async function getRecentHealthErrors(endpoint: string, limit = 5): Promise<Array<{
  status: string;
  http_status: number | null;
  error_message: string | null;
  created_at: string;
}>> {
  const sb = getSupabase();
  const { data } = await sb
    .from('lingtin_health_checks')
    .select('status, http_status, error_message, created_at')
    .eq('endpoint', endpoint)
    .neq('status', 'ok')
    .order('created_at', { ascending: false })
    .limit(limit);

  return data ?? [];
}
