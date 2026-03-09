-- User activity log table for tracking API usage
CREATE TABLE lingtin_user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  username VARCHAR(50) NOT NULL,
  employee_name VARCHAR(100),
  role_code VARCHAR(50),
  restaurant_id UUID,
  action_type VARCHAR(50) NOT NULL,
  method VARCHAR(10),
  path VARCHAR(500),
  resource_type VARCHAR(50),
  details JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_user_id ON lingtin_user_activity_log(user_id);
CREATE INDEX idx_activity_created_at ON lingtin_user_activity_log(created_at);
CREATE INDEX idx_activity_action_type ON lingtin_user_activity_log(action_type);

-- RLS: service role only (interceptor writes via service role client)
ALTER TABLE lingtin_user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON lingtin_user_activity_log
  FOR ALL USING (auth.role() = 'service_role');

-- Auto-cleanup: delete records older than 90 days (daily at 3 AM UTC)
SELECT cron.schedule(
  'cleanup-activity-log',
  '0 3 * * *',
  $$DELETE FROM lingtin_user_activity_log WHERE created_at < NOW() - INTERVAL '90 days'$$
);
