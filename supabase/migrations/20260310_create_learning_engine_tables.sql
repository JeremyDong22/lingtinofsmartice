-- Learning Engine: Knowledge Store + Learning Events + AI Metrics
-- Part of the AI self-learning infrastructure

-- ============================================================
-- 1. lingtin_knowledge_store — 核心知识存储
-- ============================================================
CREATE TABLE IF NOT EXISTS lingtin_knowledge_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 知识归属
  restaurant_id UUID REFERENCES master_restaurant(id),  -- NULL = 全局知识
  scope VARCHAR(20) NOT NULL DEFAULT 'restaurant',      -- restaurant | brand | region | global

  -- 知识分类
  knowledge_type VARCHAR(50) NOT NULL,  -- profile | example | pattern | benchmark | best_practice
  category VARCHAR(50),                 -- dish | service | environment | staff | general

  -- 知识内容
  title VARCHAR(200),
  content JSONB NOT NULL,

  -- 生命周期管理
  quality_score DECIMAL DEFAULT 0.5,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  source_signal VARCHAR(100),

  -- 元数据
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active' NOT NULL  -- active | archived | deprecated
);

-- 索引
CREATE INDEX idx_knowledge_restaurant ON lingtin_knowledge_store(restaurant_id, knowledge_type);
CREATE INDEX idx_knowledge_scope ON lingtin_knowledge_store(scope, knowledge_type, status);
CREATE INDEX idx_knowledge_active ON lingtin_knowledge_store(status, updated_at DESC);

-- RLS
ALTER TABLE lingtin_knowledge_store ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on knowledge_store"
  ON lingtin_knowledge_store
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 2. lingtin_learning_events — 学习事件日志
-- ============================================================
CREATE TABLE IF NOT EXISTS lingtin_learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  restaurant_id UUID REFERENCES master_restaurant(id),
  input_summary TEXT,
  output_knowledge_ids UUID[],
  metrics JSONB,
  status VARCHAR(20) DEFAULT 'completed' NOT NULL,  -- completed | failed | skipped
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_learning_events_date ON lingtin_learning_events(created_at DESC);
CREATE INDEX idx_learning_events_signal ON lingtin_learning_events(signal_id, created_at DESC);

ALTER TABLE lingtin_learning_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on learning_events"
  ON lingtin_learning_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 3. lingtin_ai_metrics — AI 操作效果追踪
-- ============================================================
CREATE TABLE IF NOT EXISTS lingtin_ai_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  restaurant_id UUID REFERENCES master_restaurant(id),  -- NULL = 全局
  metric_type VARCHAR(50) NOT NULL,
  metric_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_ai_metrics_type_date ON lingtin_ai_metrics(metric_type, metric_date DESC);
CREATE INDEX idx_ai_metrics_restaurant ON lingtin_ai_metrics(restaurant_id, metric_type, metric_date DESC);

ALTER TABLE lingtin_ai_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on ai_metrics"
  ON lingtin_ai_metrics
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 4. lingtin_action_items — 添加 impact 追踪字段
-- ============================================================
ALTER TABLE lingtin_action_items
  ADD COLUMN IF NOT EXISTS impact_tracked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS impact_result JSONB,
  ADD COLUMN IF NOT EXISTS impact_evaluated_at TIMESTAMPTZ;

COMMENT ON COLUMN lingtin_action_items.impact_tracked IS '是否已追踪改善效果';
COMMENT ON COLUMN lingtin_action_items.impact_result IS '改善效果评估结果 {before_score, after_score, feedback_count_before, feedback_count_after, improvement_pct}';
COMMENT ON COLUMN lingtin_action_items.impact_evaluated_at IS '效果评估时间';

-- ============================================================
-- 5. RPC: 知识使用计数原子递增
-- ============================================================
CREATE OR REPLACE FUNCTION increment_knowledge_usage(knowledge_id UUID, used_at TIMESTAMPTZ)
RETURNS void AS $$
BEGIN
  UPDATE lingtin_knowledge_store
  SET usage_count = usage_count + 1,
      last_used_at = used_at
  WHERE id = knowledge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
