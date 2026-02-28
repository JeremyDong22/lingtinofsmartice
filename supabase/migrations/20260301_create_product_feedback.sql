-- Create lingtin_product_feedback table
-- Stores employee product feedback (text and voice) with AI classification

CREATE TABLE IF NOT EXISTS lingtin_product_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES master_restaurant(id),
  employee_id UUID NOT NULL REFERENCES master_employee(id),

  -- Input
  input_type VARCHAR(10) NOT NULL DEFAULT 'text',  -- 'text' or 'voice'
  content_text TEXT NOT NULL DEFAULT '',

  -- Voice-specific
  audio_url TEXT,
  duration_seconds INTEGER,
  stt_status VARCHAR(20),          -- pending/completed/failed
  raw_transcript TEXT,
  error_message TEXT,

  -- AI classification
  category VARCHAR(50),
  ai_summary TEXT,
  priority VARCHAR(10),            -- high/medium/low
  tags JSONB DEFAULT '[]'::jsonb,

  -- Images
  image_urls TEXT[] DEFAULT '{}',

  -- Status management
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/read/in_progress/resolved/dismissed
  status_changed_at TIMESTAMPTZ,
  status_changed_by UUID,

  -- Admin reply
  admin_reply TEXT,
  admin_reply_by UUID,
  admin_reply_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_product_feedback_employee ON lingtin_product_feedback(employee_id);
CREATE INDEX idx_product_feedback_restaurant ON lingtin_product_feedback(restaurant_id);
CREATE INDEX idx_product_feedback_status ON lingtin_product_feedback(status);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_product_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_feedback_updated_at
  BEFORE UPDATE ON lingtin_product_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_product_feedback_updated_at();

-- Enable RLS
ALTER TABLE lingtin_product_feedback ENABLE ROW LEVEL SECURITY;

-- Service role full access policy
CREATE POLICY "Service role full access on product_feedback"
  ON lingtin_product_feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
