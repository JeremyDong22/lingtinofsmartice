-- Allow anon role to read beta signups (backend uses anon key)
DROP POLICY IF EXISTS "Service role read" ON lingtin_beta_signups;
CREATE POLICY "Allow anon and service role read" ON lingtin_beta_signups
  FOR SELECT
  TO anon, service_role
  USING (true);
