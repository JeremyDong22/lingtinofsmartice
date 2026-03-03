-- Add stt_model column to track which STT engine processed each recording
-- Values: dashscope_paraformer_v2 | xunfei_dialect_slm | xunfei_chinese_iat
-- Historical records will have NULL (no backfill needed)

ALTER TABLE lingtin_visit_records ADD COLUMN IF NOT EXISTS stt_model VARCHAR(30);
ALTER TABLE lingtin_meeting_records ADD COLUMN IF NOT EXISTS stt_model VARCHAR(30);
ALTER TABLE lingtin_product_feedback ADD COLUMN IF NOT EXISTS stt_model VARCHAR(30);
