// Shared Bark push notification for knowledge module

const BARK_DEVICE_KEY = process.env.BARK_DEVICE_KEY;

export async function sendBarkNotification(
  title: string,
  body: string,
  sound: 'alert' | 'alarm' = 'alert',
  group = 'lingtin-knowledge',
): Promise<void> {
  if (!BARK_DEVICE_KEY) return;

  const url =
    `https://api.day.app/${BARK_DEVICE_KEY}` +
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
