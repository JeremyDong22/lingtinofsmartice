-- Fix avg_sentiment column precision
-- Was DECIMAL(3,2) max 9.99, but sentiment scores are 0-100
-- Change to DECIMAL(5,2) to support values up to 999.99
ALTER TABLE lingtin_daily_summaries ALTER COLUMN avg_sentiment TYPE DECIMAL(5,2);
