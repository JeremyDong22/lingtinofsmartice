-- Add customer profile columns to visit records
-- customer_source: free text normalized by AI (美团/大众点评/抖音/小红书/朋友介绍/路过/老顾客/etc.)
-- visit_frequency: enum first/repeat/regular/unknown

ALTER TABLE lingtin_visit_records
  ADD COLUMN IF NOT EXISTS customer_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS visit_frequency VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_visit_records_customer_source
  ON lingtin_visit_records(customer_source) WHERE customer_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visit_records_visit_frequency
  ON lingtin_visit_records(visit_frequency) WHERE visit_frequency IS NOT NULL;
