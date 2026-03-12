-- Knowledge source tracking: link each knowledge entry to its originating record
-- Supports: visit records, meeting records, action items

ALTER TABLE lingtin_knowledge_store
  ADD COLUMN IF NOT EXISTS source_record_id UUID,
  ADD COLUMN IF NOT EXISTS source_record_type VARCHAR(50);

-- Prevent duplicate extraction + fast source lookup
CREATE INDEX IF NOT EXISTS idx_knowledge_source_record
  ON lingtin_knowledge_store(source_record_id, source_record_type)
  WHERE source_record_id IS NOT NULL;

-- Add impact tracking columns for action items experience loop
ALTER TABLE lingtin_action_items
  ADD COLUMN IF NOT EXISTS impact_tracked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS impact_result JSONB;
