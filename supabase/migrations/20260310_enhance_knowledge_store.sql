-- Knowledge Store Enhancement: 3NF + Versioning + HITL Review + Lifecycle
-- Extends lingtin_knowledge_store with brand/region FK, version chains,
-- review workflow, confidence scoring, and distillation support.

-- ============================================================
-- 1. 3NF 修正：补齐 scope 对应的外键
-- ============================================================

ALTER TABLE lingtin_knowledge_store
  ADD COLUMN IF NOT EXISTS brand_id INTEGER REFERENCES master_brand(id),
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES master_region(id);

-- ============================================================
-- 2. 版本管理
-- ============================================================

ALTER TABLE lingtin_knowledge_store
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES lingtin_knowledge_store(id);

-- ============================================================
-- 3. 来源追踪
-- ============================================================

ALTER TABLE lingtin_knowledge_store
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS source_data JSONB;

-- ============================================================
-- 4. 时效与置信度
-- ============================================================

ALTER TABLE lingtin_knowledge_store
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confidence DECIMAL DEFAULT 0.5;

-- ============================================================
-- 5. 冲突管理 — 版本链
-- ============================================================

ALTER TABLE lingtin_knowledge_store
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES lingtin_knowledge_store(id);

-- ============================================================
-- 6. HITL 审核字段
-- ============================================================

ALTER TABLE lingtin_knowledge_store
  ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS reviewer_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN DEFAULT false;

-- ============================================================
-- 7. 3NF 约束：scope 与 FK 一致性
-- ============================================================

ALTER TABLE lingtin_knowledge_store
  ADD CONSTRAINT chk_scope_fk_consistency CHECK (
    CASE scope
      WHEN 'restaurant' THEN restaurant_id IS NOT NULL AND brand_id IS NULL AND region_id IS NULL
      WHEN 'brand'      THEN brand_id IS NOT NULL AND restaurant_id IS NULL AND region_id IS NULL
      WHEN 'region'     THEN region_id IS NOT NULL AND restaurant_id IS NULL AND brand_id IS NULL
      WHEN 'global'     THEN restaurant_id IS NULL AND brand_id IS NULL AND region_id IS NULL
    END
  );

-- ============================================================
-- 8. 新索引
-- ============================================================

-- 品牌/区域级查询
CREATE INDEX IF NOT EXISTS idx_knowledge_brand
  ON lingtin_knowledge_store(brand_id, knowledge_type) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_region
  ON lingtin_knowledge_store(region_id, knowledge_type) WHERE region_id IS NOT NULL;

-- 版本链
CREATE INDEX IF NOT EXISTS idx_knowledge_version
  ON lingtin_knowledge_store(parent_id, version DESC);

-- 审核队列
CREATE INDEX IF NOT EXISTS idx_knowledge_review_status
  ON lingtin_knowledge_store(review_status, created_at DESC)
  WHERE review_status = 'pending_review';

-- 蒸馏来源查询
CREATE INDEX IF NOT EXISTS idx_knowledge_source_type
  ON lingtin_knowledge_store(source_type)
  WHERE source_type = 'distilled';

-- ============================================================
-- 9. 注释
-- ============================================================

COMMENT ON COLUMN lingtin_knowledge_store.brand_id IS '品牌级知识归属 (scope=brand 时必填)';
COMMENT ON COLUMN lingtin_knowledge_store.region_id IS '区域级知识归属 (scope=region 时必填)';
COMMENT ON COLUMN lingtin_knowledge_store.version IS '知识版本号，递增';
COMMENT ON COLUMN lingtin_knowledge_store.parent_id IS '版本链：指向同一知识的第一个版本';
COMMENT ON COLUMN lingtin_knowledge_store.source_type IS '来源类型: auto(自动学习) | manual(人工) | promoted(晋升) | distilled(蒸馏)';
COMMENT ON COLUMN lingtin_knowledge_store.source_data IS '来源详情 JSON, 如 { distilled_from: UUID[] }';
COMMENT ON COLUMN lingtin_knowledge_store.valid_from IS '知识生效起始时间';
COMMENT ON COLUMN lingtin_knowledge_store.valid_until IS '知识失效时间, NULL=永久有效';
COMMENT ON COLUMN lingtin_knowledge_store.confidence IS '置信度 0-1';
COMMENT ON COLUMN lingtin_knowledge_store.superseded_by IS '被哪个新版本替代';
COMMENT ON COLUMN lingtin_knowledge_store.review_status IS 'HITL审核状态: pending_review | approved | revision_requested | rejected';
COMMENT ON COLUMN lingtin_knowledge_store.reviewer_note IS '审核人意见';
COMMENT ON COLUMN lingtin_knowledge_store.reviewed_at IS '审核时间';
COMMENT ON COLUMN lingtin_knowledge_store.reviewed_by IS '审核人用户名';
COMMENT ON COLUMN lingtin_knowledge_store.auto_approve IS '是否免审核自动批准';
