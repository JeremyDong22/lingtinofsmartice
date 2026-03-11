-- Auto-remediation system tables
-- Tracks AI-powered auto-fix incidents triggered by health checks

-- 1. Remediation incidents (event log)
CREATE TABLE IF NOT EXISTS lingtin_remediation_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint VARCHAR(200) NOT NULL,
  trigger_type VARCHAR(20) NOT NULL DEFAULT 'heartbeat'
    CHECK (trigger_type IN ('heartbeat', 'patrol', 'manual')),
  error_message TEXT,
  http_status INT,
  diagnosis TEXT,
  root_cause VARCHAR(100)
    CHECK (root_cause IN ('runtime_error', 'dependency_timeout', 'db_query', 'auth', 'config', 'unknown')),
  fix_branch VARCHAR(100),
  fix_pr_number INT,
  fix_diff TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'triggered'
    CHECK (status IN ('triggered', 'diagnosing', 'fixing', 'deploying', 'verifying', 'resolved', 'failed', 'skipped', 'escalated')),
  verification_status VARCHAR(10)
    CHECK (verification_status IN ('ok', 'fail')),
  was_auto_merged BOOLEAN DEFAULT false,
  rollback_commit VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_remediation_incidents_endpoint ON lingtin_remediation_incidents(endpoint);
CREATE INDEX idx_remediation_incidents_status ON lingtin_remediation_incidents(status);
CREATE INDEX idx_remediation_incidents_created ON lingtin_remediation_incidents(created_at DESC);

-- 2. Per-endpoint remediation config (control plane)
CREATE TABLE IF NOT EXISTS lingtin_remediation_config (
  endpoint VARCHAR(200) PRIMARY KEY,
  auto_fix_enabled BOOLEAN NOT NULL DEFAULT true,
  max_attempts_per_day INT NOT NULL DEFAULT 3,
  auto_merge_allowed BOOLEAN NOT NULL DEFAULT false,
  cooldown_minutes INT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS policies
ALTER TABLE lingtin_remediation_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lingtin_remediation_config ENABLE ROW LEVEL SECURITY;

-- Service role full access (used by GitHub Actions remediation scripts)
CREATE POLICY "service_role_full_access_incidents"
  ON lingtin_remediation_incidents
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access_config"
  ON lingtin_remediation_config
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Anon read-only (for dashboard display)
CREATE POLICY "anon_read_incidents"
  ON lingtin_remediation_incidents
  FOR SELECT
  USING (true);

CREATE POLICY "anon_read_config"
  ON lingtin_remediation_config
  FOR SELECT
  USING (true);

-- 4. Seed default config for heartbeat endpoints
INSERT INTO lingtin_remediation_config (endpoint, auto_fix_enabled, max_attempts_per_day, auto_merge_allowed, cooldown_minutes)
VALUES
  ('/api/audio/stt-health', true, 3, false, 30),
  ('/api/auth/login', true, 3, false, 30),
  ('/', true, 2, false, 60)
ON CONFLICT (endpoint) DO NOTHING;
