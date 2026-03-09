-- Health check results (patrol + heartbeat records)
CREATE TABLE lingtin_health_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  checked_at TIMESTAMPTZ DEFAULT now(),
  check_type VARCHAR(10) NOT NULL,      -- 'heartbeat' | 'patrol'
  role_code VARCHAR(20) NOT NULL,       -- 'administrator' | 'manager' | 'head_chef' | 'system'
  endpoint VARCHAR(200) NOT NULL,       -- '/api/dashboard/briefing'
  status VARCHAR(10) NOT NULL,          -- 'ok' | 'fail' | 'timeout'
  response_ms INT,                      -- 响应时间 ms
  http_status INT,                      -- HTTP 状态码
  error_message TEXT,                   -- 失败原因
  batch_id VARCHAR(30) NOT NULL         -- '2026-03-10T09:00' 同一轮的标识
);

CREATE INDEX idx_health_checks_batch ON lingtin_health_checks(batch_id);
CREATE INDEX idx_health_checks_status ON lingtin_health_checks(status) WHERE status != 'ok';
CREATE INDEX idx_health_checks_type_time ON lingtin_health_checks(check_type, checked_at DESC);

-- Health status (latest heartbeat state per endpoint)
CREATE TABLE lingtin_health_status (
  endpoint VARCHAR(200) PRIMARY KEY,    -- '/api/auth/login'
  status VARCHAR(10) NOT NULL,          -- 'ok' | 'fail'
  last_checked_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,          -- 状态上次变化的时间
  consecutive_failures INT DEFAULT 0,   -- 连续失败次数
  last_error TEXT
);
