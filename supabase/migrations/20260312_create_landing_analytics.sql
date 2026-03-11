-- Landing Analytics: lightweight event tracking for PMF validation
-- Events: page_view, scroll_depth, dwell_time, form_start, form_submit, share_click

CREATE TABLE IF NOT EXISTS lingtin_landing_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id VARCHAR(32) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN (
    'page_view', 'scroll_depth', 'dwell_time', 'form_start', 'form_submit', 'share_click'
  )),
  payload JSONB DEFAULT '{}',
  referrer TEXT,
  user_agent TEXT,
  screen_width INT,
  screen_height INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_landing_analytics_event_type ON lingtin_landing_analytics(event_type);
CREATE INDEX idx_landing_analytics_created_at ON lingtin_landing_analytics(created_at);
CREATE INDEX idx_landing_analytics_visitor_id ON lingtin_landing_analytics(visitor_id);

-- RLS: anon can INSERT (sendBeacon from landing page), service_role reads via bypass
ALTER TABLE lingtin_landing_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_landing_analytics"
  ON lingtin_landing_analytics
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Aggregation function: returns all PMF metrics in one call
CREATE OR REPLACE FUNCTION lingtin_landing_stats(since_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days')
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH base AS (
    SELECT * FROM lingtin_landing_analytics WHERE created_at >= since_date
  ),
  metrics AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'page_view') AS total_views,
      COUNT(DISTINCT visitor_id) FILTER (WHERE event_type = 'page_view') AS unique_visitors,
      COALESCE(AVG((payload->>'seconds')::NUMERIC) FILTER (WHERE event_type = 'dwell_time'), 0) AS avg_dwell_seconds,
      COUNT(*) FILTER (WHERE event_type = 'scroll_depth' AND (payload->>'max_depth')::INT >= 75) AS scroll_75_count,
      COUNT(DISTINCT visitor_id) FILTER (WHERE event_type = 'scroll_depth') AS scroll_total_visitors,
      COUNT(*) FILTER (WHERE event_type = 'form_start') AS form_started,
      COUNT(*) FILTER (WHERE event_type = 'form_submit') AS form_submitted,
      COUNT(*) FILTER (WHERE event_type = 'share_click') AS share_clicks
    FROM base
  ),
  daily AS (
    SELECT
      created_at::DATE AS day,
      COUNT(*) FILTER (WHERE event_type = 'page_view') AS views,
      COUNT(DISTINCT visitor_id) FILTER (WHERE event_type = 'page_view') AS visitors
    FROM base
    GROUP BY created_at::DATE
    ORDER BY day
  )
  SELECT json_build_object(
    'total_views', m.total_views,
    'unique_visitors', m.unique_visitors,
    'avg_dwell_seconds', ROUND(m.avg_dwell_seconds::NUMERIC, 1),
    'scroll_75_pct', CASE WHEN m.scroll_total_visitors > 0
      THEN ROUND(m.scroll_75_count::NUMERIC / m.scroll_total_visitors * 100, 1)
      ELSE 0 END,
    'form_started', m.form_started,
    'form_submitted', m.form_submitted,
    'share_clicks', m.share_clicks,
    'daily_trend', COALESCE((SELECT json_agg(json_build_object('day', d.day, 'views', d.views, 'visitors', d.visitors)) FROM daily d), '[]'::JSON)
  ) INTO result
  FROM metrics m;

  RETURN result;
END;
$$;
