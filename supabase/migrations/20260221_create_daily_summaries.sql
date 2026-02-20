-- Daily Summaries - 每日桌访汇总 + AI 复盘议题
-- Cron 每晚 21:00 (UTC+8) 自动生成，也支持手动触发

CREATE TABLE lingtin_daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  summary_date DATE NOT NULL,
  total_visits INTEGER NOT NULL DEFAULT 0,
  avg_sentiment DECIMAL(3,2),
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  neutral_count INTEGER NOT NULL DEFAULT 0,
  agenda_items JSONB NOT NULL DEFAULT '[]',
  -- [{category, title, detail, severity, evidenceCount, suggestedAction, feedbacks: [{tableId, text}]}]
  ai_overview TEXT,                    -- 200 字当日概述
  status VARCHAR(20) NOT NULL DEFAULT 'generated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, summary_date)
);

CREATE INDEX idx_daily_summaries_restaurant_date
  ON lingtin_daily_summaries(restaurant_id, summary_date DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_daily_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_daily_summaries_updated_at
  BEFORE UPDATE ON lingtin_daily_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_summaries_updated_at();

ALTER TABLE lingtin_daily_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON lingtin_daily_summaries FOR ALL USING (true);
