-- Beta signups table for landing page registration
-- Collects prospective brand partner information for internal review

CREATE TABLE lingtin_beta_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  name VARCHAR(50) NOT NULL,
  position VARCHAR(50) NOT NULL,
  age INTEGER,
  phone VARCHAR(20) NOT NULL,
  store_count VARCHAR(50),
  annual_revenue VARCHAR(100),
  city VARCHAR(50) NOT NULL,
  help_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_phone UNIQUE (phone)
);

ALTER TABLE lingtin_beta_signups ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a signup (public form)
CREATE POLICY "Allow public insert" ON lingtin_beta_signups
  FOR INSERT WITH CHECK (true);

-- Only service_role can read signups (admin access)
CREATE POLICY "Service role read" ON lingtin_beta_signups
  FOR SELECT USING (auth.role() = 'service_role');
