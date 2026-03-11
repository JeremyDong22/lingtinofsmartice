import type { Env } from './types';

const GITHUB_REPO = 'jeremydong22/lingtinofsmartice';
const DISPATCH_EVENT = 'auto-remediate';

interface RemediationPayload {
  endpoint: string;
  error_message: string;
  http_status: number | null;
  consecutive_failures: number;
  trigger_type: 'heartbeat' | 'patrol';
}

/**
 * Trigger GitHub Actions auto-remediation workflow via repository_dispatch.
 * Called when consecutive_failures >= 3 on a heartbeat endpoint.
 */
export async function triggerRemediation(
  env: Env,
  payload: RemediationPayload,
): Promise<boolean> {
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'lingtin-health-worker',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          event_type: DISPATCH_EVENT,
          client_payload: payload,
        }),
      },
    );

    if (resp.status === 204) {
      console.log(`Remediation dispatched for ${payload.endpoint}`);
      return true;
    }

    console.error(`GitHub dispatch failed: ${resp.status} ${await resp.text()}`);
    return false;
  } catch (err) {
    console.error('GitHub dispatch error:', err);
    return false;
  }
}
