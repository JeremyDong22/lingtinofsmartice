-- Add meeting-related fields to action_items
-- Supports linking action items to meeting records

ALTER TABLE lingtin_action_items
  ADD COLUMN IF NOT EXISTS assignee TEXT,
  ADD COLUMN IF NOT EXISTS deadline TEXT,
  ADD COLUMN IF NOT EXISTS meeting_id UUID;

CREATE INDEX idx_action_items_meeting ON lingtin_action_items(meeting_id) WHERE meeting_id IS NOT NULL;
