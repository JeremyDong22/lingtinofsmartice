/**
 * Post-deploy verification: re-run the health check on the failing endpoint.
 */
export async function verifyEndpoint(
  apiBaseUrl: string,
  endpoint: string,
  timeoutMs = 15_000,
): Promise<{ ok: boolean; httpStatus: number | null; error?: string }> {
  const url = `${apiBaseUrl}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'lingtin-remediation/1.0' },
    });
    clearTimeout(timeoutId);

    return {
      ok: resp.ok,
      httpStatus: resp.status,
      error: resp.ok ? undefined : `HTTP ${resp.status}`,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      httpStatus: null,
      error: isTimeout ? 'Timeout' : String(err),
    };
  }
}

/** Wait for deployment to finish (Zeabur auto-deploys on push) */
export async function waitForDeployment(delayMs = 180_000): Promise<void> {
  console.log(`Waiting ${delayMs / 1000}s for deployment to complete...`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
