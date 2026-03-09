import type { CheckResult, CheckStatus } from './types';

/** Check a single endpoint and return result */
export async function checkEndpoint(opts: {
  url: string;
  path: string;
  description: string;
  roleCode: string;
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  timeoutMs: number;
}): Promise<CheckResult> {
  const { url, path, description, roleCode, method = 'GET', body, headers, timeoutMs } = opts;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: method === 'POST' ? body : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - start;
    const status: CheckStatus = resp.ok ? 'ok' : 'fail';

    return {
      endpoint: path,
      description,
      role_code: roleCode,
      status,
      response_ms: elapsed,
      http_status: resp.status,
      error_message: resp.ok ? null : `HTTP ${resp.status}`,
    };
  } catch (err) {
    const elapsed = Date.now() - start;
    const isTimeout = err instanceof DOMException && err.name === 'AbortError';
    return {
      endpoint: path,
      description,
      role_code: roleCode,
      status: isTimeout ? 'timeout' : 'fail',
      response_ms: elapsed,
      http_status: null,
      error_message: isTimeout ? `Timeout (>${timeoutMs}ms)` : String(err),
    };
  }
}
