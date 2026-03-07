-- Add diarization status tracking to visit records
-- Values: 'success' (dual speaker), 'single_speaker' (diarization failed), 'unavailable' (engine doesn't support it), NULL (legacy)
ALTER TABLE lingtin_visit_records
ADD COLUMN IF NOT EXISTS stt_diarization_status VARCHAR(20) DEFAULT NULL;
