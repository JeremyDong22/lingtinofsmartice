import type { Env } from './types';

/**
 * Send push notification via Bark API.
 * @param sound - 'alert' for normal, 'alarm' for urgent
 */
export async function sendBark(
  env: Env,
  title: string,
  body: string,
  sound: 'alert' | 'alarm' = 'alert',
  group: string = 'lingtin-health',
): Promise<void> {
  const url =
    `https://api.day.app/${env.BARK_DEVICE_KEY}` +
    `/${encodeURIComponent(title)}` +
    `/${encodeURIComponent(body)}` +
    `?group=${group}&sound=${sound}&level=timeSensitive`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`Bark push failed: ${resp.status} ${resp.statusText}`);
    }
  } catch (err) {
    console.error('Bark push error:', err);
  }
}
