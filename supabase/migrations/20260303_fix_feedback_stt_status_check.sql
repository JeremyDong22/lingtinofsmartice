-- Fix stt_status CHECK constraint on lingtin_product_feedback
-- Previously missing 'processing' value, causing STT pipeline errors.
-- Already applied online via Management API; this file records the change locally.

ALTER TABLE lingtin_product_feedback
  DROP CONSTRAINT IF EXISTS lingtin_product_feedback_stt_status_check;

ALTER TABLE lingtin_product_feedback
  ADD CONSTRAINT lingtin_product_feedback_stt_status_check
  CHECK (stt_status IN ('none', 'pending', 'processing', 'completed', 'error'));
