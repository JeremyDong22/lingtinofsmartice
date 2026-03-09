export interface Env {
  API_BASE_URL: string;
  FRONTEND_URL: string;
  HEALTH_ADMIN_USER: string;
  HEALTH_ADMIN_PASS: string;
  HEALTH_MANAGER_USER: string;
  HEALTH_MANAGER_PASS: string;
  HEALTH_CHEF_USER: string;
  HEALTH_CHEF_PASS: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  BARK_DEVICE_KEY: string;
  OPENROUTER_API_KEY: string;
  WORKER_SECRET: string;
}

export type CheckStatus = 'ok' | 'timeout' | 'fail';

export interface CheckResult {
  endpoint: string;
  description: string;
  role_code: string;
  status: CheckStatus;
  response_ms: number;
  http_status: number | null;
  error_message: string | null;
}

export interface HealthStatus {
  endpoint: string;
  status: CheckStatus;
  consecutive_failures: number;
  last_checked_at: string;
  last_changed_at: string | null;
  last_error: string | null;
}

export interface EndpointDef {
  path: string;
  description: string;
  role_code: string;
  method?: 'GET' | 'POST';
}
