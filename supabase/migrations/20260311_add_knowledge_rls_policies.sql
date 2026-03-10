-- Add anon role RLS policies for knowledge engine tables
-- These tables previously only had service_role policies, causing 401 on writes from backend (anon key)

-- lingtin_knowledge_store
CREATE POLICY "Anon read access on knowledge_store"
  ON lingtin_knowledge_store FOR SELECT
  USING (true);

CREATE POLICY "Anon insert access on knowledge_store"
  ON lingtin_knowledge_store FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon update access on knowledge_store"
  ON lingtin_knowledge_store FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon delete access on knowledge_store"
  ON lingtin_knowledge_store FOR DELETE
  USING (true);

-- lingtin_learning_events
CREATE POLICY "Anon read access on learning_events"
  ON lingtin_learning_events FOR SELECT
  USING (true);

CREATE POLICY "Anon insert access on learning_events"
  ON lingtin_learning_events FOR INSERT
  WITH CHECK (true);

-- lingtin_ai_metrics
CREATE POLICY "Anon read access on ai_metrics"
  ON lingtin_ai_metrics FOR SELECT
  USING (true);

CREATE POLICY "Anon insert access on ai_metrics"
  ON lingtin_ai_metrics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon update access on ai_metrics"
  ON lingtin_ai_metrics FOR UPDATE
  USING (true)
  WITH CHECK (true);
