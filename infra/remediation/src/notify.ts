const BARK_API = 'https://api.day.app';

/**
 * Send a Bark push notification.
 * Falls back gracefully if BARK_DEVICE_KEY is not set.
 */
export async function sendBark(
  title: string,
  body: string,
  sound: 'alert' | 'alarm' = 'alert',
  group = 'lingtin-remediation',
): Promise<void> {
  const deviceKey = process.env.BARK_DEVICE_KEY;
  if (!deviceKey) {
    console.log(`[Bark skip] ${title}: ${body}`);
    return;
  }

  const url =
    `${BARK_API}/${deviceKey}` +
    `/${encodeURIComponent(title)}` +
    `/${encodeURIComponent(body)}` +
    `?group=${group}&sound=${sound}&level=timeSensitive`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`Bark push failed: ${resp.status}`);
    }
  } catch (err) {
    console.error('Bark push error:', err);
  }
}
