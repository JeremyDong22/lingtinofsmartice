-- Fix: Add anon role RLS policy for lingtin_product_feedback
-- The backend uses anon key (not service_role key), consistent with other tables
-- Without this policy, INSERT/UPDATE/SELECT from backend were blocked by RLS

CREATE POLICY "anon_all_product_feedback"
  ON lingtin_product_feedback
  FOR ALL
  USING (true)
  WITH CHECK (true);
