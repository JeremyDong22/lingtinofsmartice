-- Create hotword management tables for DashScope vocabulary sync
-- v1.0 - lingtin_hotwords (source of truth) + lingtin_hotword_sync_log

-- Hotword table: local source of truth, synced to DashScope vocabulary
CREATE TABLE IF NOT EXISTS lingtin_hotwords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text VARCHAR(10) NOT NULL,
  weight SMALLINT NOT NULL DEFAULT 3,
  category VARCHAR(30) NOT NULL DEFAULT 'other',
  source VARCHAR(20) NOT NULL DEFAULT 'manual',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (text),
  CHECK ((weight BETWEEN 1 AND 5) OR (weight BETWEEN -6 AND -1)),
  CHECK (char_length(text) BETWEEN 1 AND 10)
);

-- Sync log: track each DashScope vocabulary update
CREATE TABLE IF NOT EXISTS lingtin_hotword_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  word_count INTEGER NOT NULL,
  vocabulary_id VARCHAR(100),
  status VARCHAR(20) NOT NULL,
  error_message TEXT
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_hotwords_category ON lingtin_hotwords (category);
CREATE INDEX IF NOT EXISTS idx_hotwords_enabled ON lingtin_hotwords (is_enabled);
CREATE INDEX IF NOT EXISTS idx_hotword_sync_log_synced_at ON lingtin_hotword_sync_log (synced_at DESC);

-- Enable RLS
ALTER TABLE lingtin_hotwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE lingtin_hotword_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS policies: service role full access (admin-only feature)
CREATE POLICY "Service role full access on hotwords"
  ON lingtin_hotwords FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on hotword_sync_log"
  ON lingtin_hotword_sync_log FOR ALL
  USING (auth.role() = 'service_role');
