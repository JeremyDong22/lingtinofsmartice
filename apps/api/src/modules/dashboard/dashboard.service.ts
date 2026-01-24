// Dashboard Service - Analytics business logic
// v1.0

import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';

@Injectable()
export class DashboardService {
  constructor(private readonly supabase: SupabaseService) {}

  // Get coverage statistics (visits vs table sessions)
  async getCoverageStats(restaurantId: string, date: string) {
    const client = this.supabase.getClient();

    // Get table sessions count by period
    const { data: sessions, error: sessionsError } = await client
      .from('lingtin_table_sessions')
      .select('period')
      .eq('restaurant_id', restaurantId)
      .eq('session_date', date);

    if (sessionsError) throw sessionsError;

    // Get visit records count by period
    const { data: visits, error: visitsError } = await client
      .from('lingtin_visit_records')
      .select('visit_period')
      .eq('restaurant_id', restaurantId)
      .eq('visit_date', date)
      .eq('status', 'completed');

    if (visitsError) throw visitsError;

    // Aggregate by period
    const periods = ['lunch', 'dinner'];
    const result = periods.map((period) => {
      const openCount = sessions?.filter((s) => s.period === period).length || 0;
      const visitCount =
        visits?.filter((v) => v.visit_period === period).length || 0;
      const coverage = openCount > 0 ? Math.round((visitCount / openCount) * 100) : 0;

      return {
        period,
        open_count: openCount,
        visit_count: visitCount,
        coverage,
        status: coverage >= 90 ? 'good' : coverage >= 70 ? 'warning' : 'critical',
      };
    });

    return { periods: result };
  }

  // Get top mentioned dishes with sentiment
  async getDishRanking(restaurantId: string, date: string, limit: number) {
    const client = this.supabase.getClient();

    // Get all dish mentions for the date
    const { data, error } = await client
      .from('lingtin_dish_mentions')
      .select(
        `
        dish_name,
        sentiment,
        lingtin_visit_records!inner(restaurant_id, visit_date)
      `,
      )
      .eq('lingtin_visit_records.restaurant_id', restaurantId)
      .eq('lingtin_visit_records.visit_date', date);

    if (error) throw error;

    // Aggregate by dish
    const dishMap = new Map<
      string,
      { positive: number; negative: number; neutral: number }
    >();

    data?.forEach((mention) => {
      const existing = dishMap.get(mention.dish_name) || {
        positive: 0,
        negative: 0,
        neutral: 0,
      };
      existing[mention.sentiment as 'positive' | 'negative' | 'neutral']++;
      dishMap.set(mention.dish_name, existing);
    });

    // Sort by total mentions and take top N
    const dishes = Array.from(dishMap.entries())
      .map(([name, counts]) => ({
        dish_name: name,
        mention_count: counts.positive + counts.negative + counts.neutral,
        positive: counts.positive,
        negative: counts.negative,
        neutral: counts.neutral,
      }))
      .sort((a, b) => b.mention_count - a.mention_count)
      .slice(0, limit);

    return { dishes };
  }

  // Get sentiment trend over days
  async getSentimentTrend(restaurantId: string, days: number) {
    const client = this.supabase.getClient();

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);

    const { data, error } = await client
      .from('lingtin_visit_records')
      .select('visit_date, sentiment_score')
      .eq('restaurant_id', restaurantId)
      .gte('visit_date', startDate.toISOString().split('T')[0])
      .lte('visit_date', endDate.toISOString().split('T')[0])
      .not('sentiment_score', 'is', null);

    if (error) throw error;

    // Aggregate by date
    const dateMap = new Map<string, number[]>();

    data?.forEach((record) => {
      const scores = dateMap.get(record.visit_date) || [];
      scores.push(record.sentiment_score);
      dateMap.set(record.visit_date, scores);
    });

    // Calculate averages
    const trend = Array.from(dateMap.entries())
      .map(([date, scores]) => ({
        date,
        avg_sentiment: scores.reduce((a, b) => a + b, 0) / scores.length,
        count: scores.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { trend };
  }
}
