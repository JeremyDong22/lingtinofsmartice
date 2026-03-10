-- Knowledge Depth Framework: L1 事实 → L2 规律 → L3 洞察 → L4 行动指引
-- Adds depth_level column to support multi-tier knowledge distillation.

-- ============================================================
-- 1. depth_level 列
-- ============================================================

ALTER TABLE lingtin_knowledge_store
  ADD COLUMN IF NOT EXISTS depth_level VARCHAR(2) DEFAULT 'L1'
    CHECK (depth_level IN ('L1', 'L2', 'L3', 'L4'));

COMMENT ON COLUMN lingtin_knowledge_store.depth_level IS
  'L1=事实(统计归纳), L2=规律(反复模式), L3=洞察(原因动机), L4=行动指引(最佳实践)';

-- ============================================================
-- 2. 索引：按深度 + 状态查询（L4 提炼、探索性蒸馏常用）
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_knowledge_depth_status
  ON lingtin_knowledge_store(depth_level, status, review_status)
  WHERE status = 'active';

-- ============================================================
-- 3. category 扩展说明
-- ============================================================
-- category 为 VARCHAR(50)，无 CHECK 约束，直接写入新值即可：
--   best_practice, opportunity, emergent
-- 无需 DDL 变更。
