-- 反馈聚合问题追踪表
-- 将同类反馈聚合为"问题"，支持多角色独立操作和管理层回复

CREATE TABLE lingtin_feedback_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,

  -- 问题标识
  category VARCHAR(30) NOT NULL,       -- dish_quality/service_speed/environment/staff_attitude/other
  topic TEXT NOT NULL,                  -- 聚合后的主题标签，如"上菜速度慢"
  topic_keywords TEXT[] DEFAULT '{}',   -- 匹配用的变体文本

  -- 频次统计
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurrence_count INT NOT NULL DEFAULT 1,
  daily_counts JSONB DEFAULT '[]',     -- 14 天滚动窗口 [{"date":"2026-03-14","count":3}]

  -- 证据（最近 20 条）
  evidence JSONB DEFAULT '[]',
  -- [{"visit_record_id","feedback_text","table_id","date","audio_url","sentiment","score"}]

  -- 综合状态
  classification VARCHAR(20) NOT NULL DEFAULT 'unclassified',
  classified_by VARCHAR(100),
  classified_at TIMESTAMPTZ,

  -- 店长操作
  manager_classification VARCHAR(20),
  manager_action_note TEXT,
  manager_action_at TIMESTAMPTZ,
  manager_action_by VARCHAR(100),

  -- 厨师长操作
  chef_classification VARCHAR(20),
  chef_action_note TEXT,
  chef_action_at TIMESTAMPTZ,
  chef_action_by VARCHAR(100),

  -- 管理层回复
  management_reply TEXT,
  management_reply_by VARCHAR(100),
  management_reply_at TIMESTAMPTZ,
  management_reply_read_by_manager BOOLEAN DEFAULT FALSE,
  management_reply_read_by_chef BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_fi_restaurant ON lingtin_feedback_issues(restaurant_id, classification);
CREATE INDEX idx_fi_last_seen ON lingtin_feedback_issues(last_seen_at DESC);
CREATE UNIQUE INDEX idx_fi_topic ON lingtin_feedback_issues(restaurant_id, category, topic);

-- RLS
ALTER TABLE lingtin_feedback_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_feedback_issues" ON lingtin_feedback_issues
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_feedback_issues" ON lingtin_feedback_issues
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_feedback_issues" ON lingtin_feedback_issues
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
