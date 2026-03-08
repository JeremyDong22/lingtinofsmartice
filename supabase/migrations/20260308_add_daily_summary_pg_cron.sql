-- Add pg_cron job to trigger daily summary generation via pg_net HTTP call
-- Runs at UTC 13:00 (Beijing 21:00) every day
-- More reliable than NestJS in-process @Cron which can miss if container restarts

SELECT cron.schedule(
  'daily-summary-trigger',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lingtinapi.preview.aliyun-zeabur.cn/api/daily-summary/cron-trigger',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
