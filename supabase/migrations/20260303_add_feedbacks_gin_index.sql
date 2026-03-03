-- GIN index on feedbacks JSONB to accelerate jsonb_array_elements queries
-- Used by: Boss negDishes, Chef negDishes/posDishes, Manager posDishes briefing queries
CREATE INDEX IF NOT EXISTS idx_visit_records_feedbacks_gin
  ON lingtin_visit_records USING GIN (feedbacks);
