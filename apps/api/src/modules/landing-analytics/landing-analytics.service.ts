// Landing Analytics Service - DB operations for landing page event tracking

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';

interface AnalyticsEvent {
  visitor_id: string;
  session_id: string;
  event_type: string;
  payload?: Record<string, unknown>;
  referrer?: string;
  user_agent?: string;
  screen_width?: number;
  screen_height?: number;
}

const VALID_EVENT_TYPES = new Set([
  'page_view', 'scroll_depth', 'dwell_time', 'form_start', 'form_submit', 'share_click',
]);

@Injectable()
export class LandingAnalyticsService {
  private readonly logger = new Logger(LandingAnalyticsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async insertEvents(events: AnalyticsEvent[]): Promise<void> {
    const valid = events.filter(e =>
      e.visitor_id && e.session_id && VALID_EVENT_TYPES.has(e.event_type),
    );

    if (valid.length === 0) return;

    const client = this.supabase.getClient();
    const { error } = await client
      .from('lingtin_landing_analytics')
      .insert(valid.map(e => ({
        visitor_id: e.visitor_id.slice(0, 32),
        session_id: e.session_id.slice(0, 64),
        event_type: e.event_type,
        payload: e.payload || {},
        referrer: e.referrer?.slice(0, 2000),
        user_agent: e.user_agent?.slice(0, 500),
        screen_width: e.screen_width,
        screen_height: e.screen_height,
      })));

    if (error) {
      this.logger.error('Failed to insert analytics events', error);
      throw error;
    }

    this.logger.log(`Inserted ${valid.length} analytics events`);
  }

  async getStats(days: number): Promise<Record<string, unknown>> {
    const client = this.supabase.getClient();
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const dateStr = sinceDate.toISOString().split('T')[0];

    const { data, error } = await client.rpc('lingtin_landing_stats', {
      since_date: dateStr,
    });

    if (error) {
      this.logger.error('Failed to get landing stats', error);
      throw error;
    }

    return data;
  }
}
