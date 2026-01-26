// Dashboard Service - Analytics business logic
// v1.2 - Fixed status filter: use 'processed' instead of 'completed'

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
      .eq('status', 'processed');

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

  // Get sentiment distribution summary for a date
  async getSentimentSummary(restaurantId: string, date: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('lingtin_visit_records')
      .select('sentiment_score')
      .eq('restaurant_id', restaurantId)
      .eq('visit_date', date)
      .eq('status', 'processed')
      .not('sentiment_score', 'is', null);

    if (error) throw error;

    // Categorize by sentiment thresholds (score is 0-1 scale)
    // 0.0-0.4 = negative, 0.4-0.6 = neutral, 0.6-1.0 = positive
    let positive = 0;
    let neutral = 0;
    let negative = 0;

    data?.forEach((record) => {
      const score = parseFloat(record.sentiment_score);
      if (score >= 0.6) positive++;
      else if (score <= 0.4) negative++;
      else neutral++;
    });

    const total = data?.length || 0;

    return {
      positive_count: positive,
      neutral_count: neutral,
      negative_count: negative,
      positive_percent: total > 0 ? Math.round((positive / total) * 100) : 0,
      neutral_percent: total > 0 ? Math.round((neutral / total) * 100) : 0,
      negative_percent: total > 0 ? Math.round((negative / total) * 100) : 0,
      total_visits: total,
    };
  }

  // Get speech highlights (good and bad examples)
  async getSpeechHighlights(restaurantId: string, date: string) {
    const client = this.supabase.getClient();

    // Get positive examples (high sentiment with good transcripts)
    const { data: positiveData, error: positiveError } = await client
      .from('lingtin_visit_records')
      .select('table_id, corrected_transcript, ai_summary, sentiment_score, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('visit_date', date)
      .eq('status', 'processed')
      .gte('sentiment_score', 0.5)
      .not('corrected_transcript', 'is', null)
      .order('sentiment_score', { ascending: false })
      .limit(3);

    if (positiveError) throw positiveError;

    // Get negative examples (low sentiment or generic responses)
    const { data: negativeData, error: negativeError } = await client
      .from('lingtin_visit_records')
      .select('table_id, corrected_transcript, ai_summary, sentiment_score, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('visit_date', date)
      .eq('status', 'processed')
      .lte('sentiment_score', 0.2)
      .not('corrected_transcript', 'is', null)
      .order('sentiment_score', { ascending: true })
      .limit(3);

    if (negativeError) throw negativeError;

    // Format positive examples
    const positive = positiveData?.map((record) => {
      const time = new Date(record.created_at).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      // Extract a key phrase from transcript
      const text =
        record.ai_summary ||
        record.corrected_transcript?.substring(0, 50) + '...' ||
        '优质服务';
      return {
        text,
        table: record.table_id,
        time,
      };
    }) || [];

    // Format negative examples with suggestions
    const negative = negativeData?.map((record) => {
      const text =
        record.corrected_transcript?.substring(0, 30) || '回复较简短';
      let suggestion = '建议主动询问用餐体验';
      if (record.sentiment_score < 0) {
        suggestion = '建议关注顾客反馈并及时处理';
      } else if (text.length < 20) {
        suggestion = '建议引导具体菜品反馈';
      }
      return {
        text,
        suggestion,
      };
    }) || [];

    return { positive, negative };
  }
}
