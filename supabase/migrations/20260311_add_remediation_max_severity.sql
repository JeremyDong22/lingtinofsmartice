-- Add severity tier support to remediation config
ALTER TABLE lingtin_remediation_config
  ADD COLUMN IF NOT EXISTS max_severity VARCHAR(10) NOT NULL DEFAULT 'moderate'
    CHECK (max_severity IN ('minor', 'moderate', 'major'));

-- Add severity to incidents for tracking
ALTER TABLE lingtin_remediation_incidents
  ADD COLUMN IF NOT EXISTS severity VARCHAR(10)
    CHECK (severity IN ('minor', 'moderate', 'major'));
