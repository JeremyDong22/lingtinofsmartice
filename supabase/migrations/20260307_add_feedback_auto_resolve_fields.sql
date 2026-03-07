-- Add fields for feedback auto-resolve notification system
-- reply_read_at: tracks when employee read the admin reply (for unread badge)
-- resolved_version: links feedback resolution to a specific app version

ALTER TABLE lingtin_product_feedback
  ADD COLUMN IF NOT EXISTS reply_read_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolved_version VARCHAR(20) DEFAULT NULL;

-- Index for efficient unread reply queries
CREATE INDEX IF NOT EXISTS idx_product_feedback_unread_reply
  ON lingtin_product_feedback (employee_id)
  WHERE admin_reply IS NOT NULL AND reply_read_at IS NULL;
