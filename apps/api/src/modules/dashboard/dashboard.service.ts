// Dashboard Service - Analytics business logic
// v2.3 - Added: getReviewCompletionStats() + getMultiRestaurantReviewCompletion() for review completion tracking
// v2.2 - Added: getBriefing() for admin daily briefing (cross-restaurant anomaly detection)
// v2.1 - Added: getRestaurantDetail() for restaurant detail page
// v2.0 - Added: getRestaurantsOverview() for admin dashboard with sentiment scores
// v1.9 - Added: Multi-restaurant support for administrator role
//        - getRestaurantList() returns all active restaurants
//        - getCoverageStats() supports restaurant_id=all for multi-store summary
//        - getSentimentSummary() supports restaurant_id=all for aggregated data

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { getChinaDateString, toChinaDateString } from '../../common/utils/date';

// Interface for feedback with conversation context (used in sentiment summary)
export interface FeedbackWithContext {
  text: string;
  visitId: string;
  tableId: string;
  managerQuestions: string[];
  customerAnswers: string[];
  transcript: string;
  audioUrl: string | null;
  restaurantId: string;
}

// Interface for negative feedback conversation context (used in dish ranking)
export interface NegContext {
  visitId: string;
  tableId: string;
  managerQuestions: string[];
  customerAnswers: string[];
  audioUrl: string | null;
}

// Severity for briefing problem cards
type BriefingSeverity = 'red' | 'yellow';
// Category icons for briefing
type BriefingCategory = 'dish_quality' | 'service_speed' | 'staff_attitude' | 'environment' | 'coverage' | 'review_completion' | 'sentiment' | 'no_visits' | 'action_overdue';

export interface BriefingProblem {
  severity: BriefingSeverity;
  category: BriefingCategory;
  restaurantId: string;
  restaurantName: string;
  title: string;
  evidence: { text: string; tableId: string; audioUrl: string | null; managerQuestions: string[]; customerAnswers: string[] }[];
  metric?: string;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // Parse managed_ids query param: "uuid1,uuid2" → string[] | null
  static parseManagedIds(managedIdsStr?: string): string[] | null {
    if (!managedIdsStr) return null;
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ids = managedIdsStr.split(',').filter(id => UUID_REGEX.test(id.trim()));
    return ids.length > 0 ? ids : null;
  }

  // Get visible restaurants: scoped by managedIds or all active
  private async getVisibleRestaurants(managedIds: string[] | null): Promise<{ id: string; restaurant_name: string; brand_id: number | null; brand_name: string | null }[]> {
    const client = this.supabase.getClient();
    let query = client
      .from('master_restaurant')
      .select('id, restaurant_name, brand_id, master_brand(name)')
      .eq('is_active', true)
      .order('restaurant_name');

    if (managedIds) {
      query = query.in('id', managedIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      restaurant_name: r.restaurant_name as string,
      brand_id: (r.brand_id as number) ?? null,
      brand_name: (r.master_brand as { name: string } | null)?.name ?? null,
    }));
  }

  // Get all active restaurants (for administrator multi-store view)
  async getRestaurantList(managedIds: string[] | null = null) {
    if (this.supabase.isMockMode()) {
      return { restaurants: [{ id: 'mock-rest-1', restaurant_name: '测试店铺' }] };
    }
    const restaurants = await this.getVisibleRestaurants(managedIds);
    return { restaurants };
  }

  // Get review completion stats: how many days with visits also have daily_review meetings
  async getReviewCompletionStats(restaurantId: string, startDate: string, endDate: string) {
    if (this.supabase.isMockMode()) {
      return { total_days: 10, reviewed_days: 8, completion_rate: 80, streak: 5 };
    }
    const client = this.supabase.getClient();

    // Parallel: visit dates + meeting dates
    const [visitDaysRes, meetingDaysRes] = await Promise.all([
      client
        .from('lingtin_visit_records')
        .select('visit_date')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'processed')
        .gte('visit_date', startDate)
        .lte('visit_date', endDate),
      client
        .from('lingtin_meeting_records')
        .select('meeting_date')
        .eq('restaurant_id', restaurantId)
        .eq('meeting_type', 'daily_review')
        .gte('meeting_date', startDate)
        .lte('meeting_date', endDate),
    ]);
    if (visitDaysRes.error) throw visitDaysRes.error;
    if (meetingDaysRes.error) throw meetingDaysRes.error;

    const uniqueVisitDates = [...new Set((visitDaysRes.data || []).map(v => v.visit_date))].sort();
    const reviewedDatesSet = new Set((meetingDaysRes.data || []).map(m => m.meeting_date));

    const totalDays = uniqueVisitDates.length;
    const reviewedDays = uniqueVisitDates.filter(d => reviewedDatesSet.has(d)).length;
    const completionRate = totalDays > 0 ? Math.round((reviewedDays / totalDays) * 100) : 0;

    // Calculate streak: count consecutive reviewed days working backwards from the range end (or today, whichever is earlier)
    let streak = 0;
    const today = getChinaDateString();
    const loopStart = today < endDate ? today : endDate;
    const allVisitDatesSet = new Set(uniqueVisitDates);
    for (let d = new Date(loopStart + 'T00:00:00+08:00'); ; d.setDate(d.getDate() - 1)) {
      const dateStr = toChinaDateString(d);
      if (dateStr < startDate) break;
      if (dateStr > endDate) continue; // skip days past range end
      if (!allVisitDatesSet.has(dateStr)) continue; // skip days without visits
      if (reviewedDatesSet.has(dateStr)) {
        streak++;
      } else {
        break;
      }
    }

    return { total_days: totalDays, reviewed_days: reviewedDays, completion_rate: completionRate, streak };
  }

  // Multi-restaurant review completion
  async getMultiRestaurantReviewCompletion(startDate: string, endDate: string, managedIds: string[] | null = null) {
    const restaurants = await this.getVisibleRestaurants(managedIds);
    const results = await Promise.all(
      restaurants.map(async (r) => {
        const stats = await this.getReviewCompletionStats(r.id, startDate, endDate);
        return { id: r.id, name: r.restaurant_name, ...stats };
      }),
    );
    const totalRate = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.completion_rate, 0) / results.length)
      : 0;
    return { avg_completion_rate: totalRate, restaurants: results };
  }

  // Get coverage statistics (visits vs table sessions)
  // Supports restaurant_id=all for multi-store summary
  async getCoverageStats(restaurantId: string, startDate: string, endDate: string, managedIds: string[] | null = null) {
    if (this.supabase.isMockMode()) {
      return {
        periods: [
          { period: 'lunch', open_count: 12, visit_count: 10, coverage: 83, status: 'warning' },
          { period: 'dinner', open_count: 15, visit_count: 14, coverage: 93, status: 'good' },
        ],
      };
    }

    const client = this.supabase.getClient();

    // Multi-restaurant mode: return per-restaurant breakdown with summary
    if (restaurantId === 'all') {
      return this.getMultiRestaurantCoverage(startDate, endDate, managedIds);
    }

    // Single restaurant mode — parallel queries
    const [sessionsRes, visitsRes] = await Promise.all([
      client
        .from('lingtin_table_sessions')
        .select('period')
        .eq('restaurant_id', restaurantId)
        .gte('session_date', startDate)
        .lte('session_date', endDate),
      client
        .from('lingtin_visit_records')
        .select('visit_period')
        .eq('restaurant_id', restaurantId)
        .gte('visit_date', startDate)
        .lte('visit_date', endDate)
        .eq('status', 'processed'),
    ]);

    if (sessionsRes.error) throw sessionsRes.error;
    if (visitsRes.error) throw visitsRes.error;
    const sessions = sessionsRes.data;
    const visits = visitsRes.data;

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

  // Get coverage stats for all restaurants (admin multi-store view)
  private async getMultiRestaurantCoverage(startDate: string, endDate: string, managedIds: string[] | null = null) {
    const client = this.supabase.getClient();

    // Parallel: restaurants + sessions + visits
    const [restaurants, sessionsRes, visitsRes] = await Promise.all([
      this.getVisibleRestaurants(managedIds),
      client
        .from('lingtin_table_sessions')
        .select('restaurant_id, period')
        .gte('session_date', startDate)
        .lte('session_date', endDate),
      client
        .from('lingtin_visit_records')
        .select('restaurant_id, visit_period')
        .gte('visit_date', startDate)
        .lte('visit_date', endDate)
        .eq('status', 'processed'),
    ]);

    if (sessionsRes.error) throw sessionsRes.error;
    if (visitsRes.error) throw visitsRes.error;
    const allSessions = sessionsRes.data;
    const allVisits = visitsRes.data;

    // Calculate per-restaurant stats
    const periods = ['lunch', 'dinner'];
    let totalOpen = 0;
    let totalVisit = 0;

    const restaurantStats = (restaurants || []).map((rest) => {
      const restSessions = allSessions?.filter((s) => s.restaurant_id === rest.id) || [];
      const restVisits = allVisits?.filter((v) => v.restaurant_id === rest.id) || [];

      const periodStats = periods.map((period) => {
        const openCount = restSessions.filter((s) => s.period === period).length;
        const visitCount = restVisits.filter((v) => v.visit_period === period).length;
        const coverage = openCount > 0 ? Math.round((visitCount / openCount) * 100) : 0;

        totalOpen += openCount;
        totalVisit += visitCount;

        return {
          period,
          open_count: openCount,
          visit_count: visitCount,
          coverage,
        };
      });

      // Calculate overall status for this restaurant
      const restTotalOpen = periodStats.reduce((sum, p) => sum + p.open_count, 0);
      const restTotalVisit = periodStats.reduce((sum, p) => sum + p.visit_count, 0);
      const overallCoverage = restTotalOpen > 0 ? Math.round((restTotalVisit / restTotalOpen) * 100) : 0;

      return {
        id: rest.id,
        name: rest.restaurant_name,
        periods: periodStats,
        overall_coverage: overallCoverage,
        status: overallCoverage >= 90 ? 'good' : overallCoverage >= 70 ? 'warning' : 'critical',
      };
    });

    return {
      summary: {
        total_open: totalOpen,
        total_visit: totalVisit,
        coverage: totalOpen > 0 ? Math.round((totalVisit / totalOpen) * 100) : 0,
      },
      restaurants: restaurantStats,
    };
  }

  // Get top feedback items with sentiment (from feedbacks JSONB, not dish_mentions table)
  // Note: lingtin_dish_mentions table is deprecated — AI pipeline only writes to feedbacks JSONB
  async getDishRanking(restaurantId: string, startDate: string, endDate: string, limit: number) {
    if (this.supabase.isMockMode()) {
      return {
        dishes: [
          { dish_name: '清蒸鲈鱼', mention_count: 8, positive: 6, negative: 1, neutral: 1, negative_feedbacks: [{ text: '偏咸', count: 1, contexts: [{ visitId: 'mock-1', tableId: 'B4', managerQuestions: ['这道鱼觉得怎么样？'], customerAnswers: ['味道偏咸了，鱼倒是新鲜的'], audioUrl: null }] }] },
          { dish_name: '红烧肉', mention_count: 6, positive: 4, negative: 2, neutral: 0, negative_feedbacks: [{ text: '太油腻', count: 1, contexts: [{ visitId: 'mock-2', tableId: 'A2', managerQuestions: ['红烧肉还合口味吗？'], customerAnswers: ['太油腻了，吃不了几块'], audioUrl: null }] }, { text: '肉太硬', count: 1, contexts: [{ visitId: 'mock-3', tableId: 'C1', managerQuestions: ['菜品口感怎么样？'], customerAnswers: ['红烧肉有点硬，没炖烂'], audioUrl: null }] }] },
          { dish_name: '宫保鸡丁', mention_count: 5, positive: 5, negative: 0, neutral: 0, negative_feedbacks: [] },
          { dish_name: '麻婆豆腐', mention_count: 4, positive: 2, negative: 1, neutral: 1, negative_feedbacks: [{ text: '不够辣', count: 1, contexts: [{ visitId: 'mock-4', tableId: 'B2', managerQuestions: ['麻婆豆腐辣度可以吗？'], customerAnswers: ['不够辣，我们四川人吃着没感觉'], audioUrl: null }] }] },
          { dish_name: '糖醋排骨', mention_count: 3, positive: 1, negative: 2, neutral: 0, negative_feedbacks: [{ text: '太甜', count: 2, contexts: [{ visitId: 'mock-5', tableId: 'A5', managerQuestions: ['排骨味道还行吗？'], customerAnswers: ['太甜了，糖放多了'], audioUrl: null }, { visitId: 'mock-6', tableId: 'B1', managerQuestions: ['今天点的菜还满意吗？'], customerAnswers: ['糖醋排骨甜得发腻'], audioUrl: null }] }] },
        ].slice(0, limit),
      };
    }
    const client = this.supabase.getClient();

    // Get visit records with feedbacks JSONB (the actual data source)
    const { data, error } = await client
      .from('lingtin_visit_records')
      .select('id, table_id, feedbacks, manager_questions, customer_answers, audio_url')
      .eq('restaurant_id', restaurantId)
      .gte('visit_date', startDate)
      .lte('visit_date', endDate)
      .eq('status', 'processed');

    if (error) throw error;

    // Aggregate feedbacks by text (each feedback item = one "mention")
    const feedbackMap = new Map<
      string,
      {
        positive: number;
        negative: number;
        neutral: number;
        negContexts: NegContext[];
      }
    >();

    for (const record of (data || [])) {
      const feedbacks = record.feedbacks || [];
      for (const fb of feedbacks) {
        if (typeof fb !== 'object' || !fb.text) continue;
        // Skip suggestion-type feedbacks (not dish/service feedback)
        if (fb.sentiment === 'suggestion') continue;

        const text = fb.text;
        const existing = feedbackMap.get(text) || {
          positive: 0,
          negative: 0,
          neutral: 0,
          negContexts: [],
        };

        const sentiment = fb.sentiment as 'positive' | 'negative' | 'neutral';
        if (sentiment in existing) {
          existing[sentiment]++;
        }

        if (sentiment === 'negative' && existing.negContexts.length < 3) {
          existing.negContexts.push({
            visitId: record.id,
            tableId: record.table_id,
            managerQuestions: record.manager_questions || [],
            customerAnswers: record.customer_answers || [],
            audioUrl: record.audio_url || null,
          });
        }

        feedbackMap.set(text, existing);
      }
    }

    // Sort by total mentions and take top N
    const dishes = Array.from(feedbackMap.entries())
      .map(([text, counts]) => ({
        dish_name: text,
        mention_count: counts.positive + counts.negative + counts.neutral,
        positive: counts.positive,
        negative: counts.negative,
        neutral: counts.neutral,
        negative_feedbacks: counts.negContexts.length > 0
          ? [{ text, count: counts.negative, contexts: counts.negContexts }]
          : [],
      }))
      .sort((a, b) => b.mention_count - a.mention_count)
      .slice(0, limit);

    return { dishes };
  }

  // Get sentiment trend over days
  async getSentimentTrend(restaurantId: string, days: number) {
    const client = this.supabase.getClient();

    // Calculate date range in China timezone
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);

    const { data, error } = await client
      .from('lingtin_visit_records')
      .select('visit_date, sentiment_score')
      .eq('restaurant_id', restaurantId)
      .gte('visit_date', toChinaDateString(startDate))
      .lte('visit_date', toChinaDateString(endDate))
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

  // Get sentiment distribution summary for a date range with feedback phrases
  // v1.7 - Added: Include conversation context for each feedback (for popover display)
  // v1.9 - Added: Support restaurant_id=all for multi-store aggregation
  // v1.10 - Added: Date range support (startDate/endDate)
  async getSentimentSummary(restaurantId: string, startDate: string, endDate: string, managedIds: string[] | null = null) {
    if (this.supabase.isMockMode()) {
      return {
        positive_count: 12, neutral_count: 5, negative_count: 3,
        positive_percent: 60, neutral_percent: 25, negative_percent: 15,
        total_feedbacks: 20,
        positive_feedbacks: [
          { text: '味道很好', count: 4, contexts: [
            { text: '味道很好', visitId: 'mock-v1', tableId: 'A3', managerQuestions: ['今天菜品口味满意吗？'], customerAnswers: ['味道很好，特别是那道清蒸鲈鱼'], transcript: '', audioUrl: null },
            { text: '味道很好', visitId: 'mock-v2', tableId: 'B1', managerQuestions: ['觉得怎么样？'], customerAnswers: ['味道很好，下次还来'], transcript: '', audioUrl: null },
          ] },
          { text: '服务热情', count: 3, contexts: [
            { text: '服务热情', visitId: 'mock-v3', tableId: 'C2', managerQuestions: ['服务还满意吗？'], customerAnswers: ['很满意，服务员很热情，一直帮我们加水'], transcript: '', audioUrl: null },
          ] },
          { text: '环境不错', count: 2, contexts: [
            { text: '环境不错', visitId: 'mock-v4', tableId: 'A5', managerQuestions: ['用餐环境还好吗？'], customerAnswers: ['挺好的，很干净，音乐也好听'], transcript: '', audioUrl: null },
          ] },
        ],
        negative_feedbacks: [
          { text: '上菜慢', count: 2, contexts: [
            { text: '上菜慢', visitId: 'mock-v5', tableId: 'B4', managerQuestions: ['等了多久了？', '对用餐体验满意吗？'], customerAnswers: ['快半小时了吧', '上菜太慢了，孩子都饿哭了'], transcript: '', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
            { text: '上菜慢', visitId: 'mock-v6', tableId: 'A6', managerQuestions: ['今天用餐还顺利吗？'], customerAnswers: ['等太久了，催了两次'], transcript: '', audioUrl: null },
          ] },
          { text: '偏咸', count: 1, contexts: [
            { text: '偏咸', visitId: 'mock-v7', tableId: 'C1', managerQuestions: ['口味怎么样？'], customerAnswers: ['有点咸，特别是那个红烧肉'], transcript: '', audioUrl: null },
          ] },
        ],
        by_restaurant: [
          {
            restaurant_id: 'mock-rest-1', restaurant_name: '望京旗舰店',
            positive_count: 7, negative_count: 2,
            positive_feedbacks: [
              { text: '味道很好', count: 4, contexts: [] },
              { text: '服务热情', count: 3, contexts: [] },
            ],
            negative_feedbacks: [
              { text: '上菜慢', count: 2, contexts: [] },
            ],
          },
          {
            restaurant_id: 'mock-rest-2', restaurant_name: '三里屯店',
            positive_count: 5, negative_count: 1,
            positive_feedbacks: [
              { text: '环境不错', count: 2, contexts: [] },
            ],
            negative_feedbacks: [
              { text: '偏咸', count: 1, contexts: [] },
            ],
          },
        ],
      };
    }
    const client = this.supabase.getClient();

    // Build query - either for single restaurant or all restaurants
    let query = client
      .from('lingtin_visit_records')
      .select('id, table_id, feedbacks, manager_questions, customer_answers, corrected_transcript, audio_url, restaurant_id')
      .gte('visit_date', startDate)
      .lte('visit_date', endDate)
      .eq('status', 'processed');

    // Filter by restaurant scope
    if (restaurantId !== 'all') {
      query = query.eq('restaurant_id', restaurantId);
    } else if (managedIds) {
      query = query.in('restaurant_id', managedIds);
    }

    // Parallel: start restaurant lookup alongside the main query when cross-restaurant
    const restaurantsPromise = restaurantId === 'all'
      ? this.getVisibleRestaurants(managedIds)
      : Promise.resolve(null);

    const [{ data, error }, restaurants] = await Promise.all([query, restaurantsPromise]);

    if (error) throw error;

    // Count by individual feedback sentiment labels
    let positive = 0;
    let neutral = 0;
    let negative = 0;

    // Collect feedback with conversation context
    const positiveFeedbacks: FeedbackWithContext[] = [];
    const negativeFeedbacks: FeedbackWithContext[] = [];

    data?.forEach((record) => {
      const feedbacks = record.feedbacks || [];
      feedbacks.forEach(
        (fb: { text: string; sentiment: string } | string) => {
          if (typeof fb === 'object' && fb.text) {
            const context: FeedbackWithContext = {
              text: fb.text,
              visitId: record.id,
              tableId: record.table_id,
              managerQuestions: record.manager_questions || [],
              customerAnswers: record.customer_answers || [],
              transcript: record.corrected_transcript || '',
              audioUrl: record.audio_url || null,
              restaurantId: record.restaurant_id || '',
            };
            if (fb.sentiment === 'positive') {
              positive++;
              positiveFeedbacks.push(context);
            } else if (fb.sentiment === 'negative') {
              negative++;
              negativeFeedbacks.push(context);
            } else if (fb.sentiment === 'neutral') {
              neutral++;
            }
          }
        },
      );
    });

    // Group feedbacks by text and aggregate contexts
    const groupFeedbacks = (feedbacks: FeedbackWithContext[], limit: number) => {
      const groupMap = new Map<string, { count: number; contexts: FeedbackWithContext[] }>();
      feedbacks.forEach((fb) => {
        const existing = groupMap.get(fb.text) || { count: 0, contexts: [] };
        existing.count++;
        // Only keep first 3 contexts per feedback text
        if (existing.contexts.length < 3) {
          existing.contexts.push(fb);
        }
        groupMap.set(fb.text, existing);
      });
      return Array.from(groupMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit)
        .map(([text, data]) => ({
          text,
          count: data.count,
          contexts: data.contexts,
        }));
    };

    const total = positive + neutral + negative;

    // Per-restaurant breakdown when cross-restaurant
    let byRestaurantResult: {
      restaurant_id: string;
      restaurant_name: string;
      positive_count: number;
      negative_count: number;
      positive_feedbacks: { text: string; count: number; contexts: FeedbackWithContext[] }[];
      negative_feedbacks: { text: string; count: number; contexts: FeedbackWithContext[] }[];
    }[] | undefined;

    if (restaurantId === 'all' && restaurants) {
      const restNameMap = new Map(restaurants.map(r => [r.id, r.restaurant_name]));

      const restBuckets = new Map<string, { positive: FeedbackWithContext[]; negative: FeedbackWithContext[] }>();
      for (const fb of positiveFeedbacks) {
        const bucket = restBuckets.get(fb.restaurantId) || { positive: [], negative: [] };
        bucket.positive.push(fb);
        restBuckets.set(fb.restaurantId, bucket);
      }
      for (const fb of negativeFeedbacks) {
        const bucket = restBuckets.get(fb.restaurantId) || { positive: [], negative: [] };
        bucket.negative.push(fb);
        restBuckets.set(fb.restaurantId, bucket);
      }

      byRestaurantResult = Array.from(restBuckets.entries())
        .map(([restId, bucket]) => ({
          restaurant_id: restId,
          restaurant_name: restNameMap.get(restId) || restId,
          positive_count: bucket.positive.length,
          negative_count: bucket.negative.length,
          positive_feedbacks: groupFeedbacks(bucket.positive, 6),
          negative_feedbacks: groupFeedbacks(bucket.negative, 6),
        }))
        .sort((a, b) => b.negative_count - a.negative_count);
    }

    return {
      positive_count: positive,
      neutral_count: neutral,
      negative_count: negative,
      positive_percent: total > 0 ? Math.round((positive / total) * 100) : 0,
      neutral_percent: total > 0 ? Math.round((neutral / total) * 100) : 0,
      negative_percent: total > 0 ? Math.round((negative / total) * 100) : 0,
      total_feedbacks: total,
      positive_feedbacks: groupFeedbacks(positiveFeedbacks, 6),
      negative_feedbacks: groupFeedbacks(negativeFeedbacks, 6),
      ...(byRestaurantResult ? { by_restaurant: byRestaurantResult } : {}),
    };
  }

  // Get all restaurants overview with sentiment scores and keywords (for admin dashboard)
  // Returns: restaurant list with visit count, avg sentiment, coverage, recent keywords
  async getRestaurantsOverview(startDate: string, endDate: string, managedIds: string[] | null = null) {
    if (this.supabase.isMockMode()) {
      return {
        summary: { total_visits: 28, avg_sentiment: 72, restaurant_count: 3 },
        restaurants: [
          { id: 'mock-rest-1', name: '望京旗舰店', visit_count: 15, open_count: 20, coverage: 75, avg_sentiment: 68, keywords: ['清蒸鲈鱼', '服务热情', '偏咸', '红烧肉'] },
          { id: 'mock-rest-2', name: '三里屯店', visit_count: 8, open_count: 15, coverage: 53, avg_sentiment: 65, keywords: ['上菜慢', '环境不错', '宫保鸡丁'] },
          { id: 'mock-rest-3', name: '国贸店', visit_count: 5, open_count: 6, coverage: 83, avg_sentiment: 88, keywords: ['味道好', '分量足'] },
        ],
        recent_keywords: ['清蒸鲈鱼', '服务热情', '偏咸', '上菜慢', '环境不错', '味道好', '红烧肉', '宫保鸡丁', '分量足'],
      };
    }
    const client = this.supabase.getClient();

    // Get visible restaurants (scoped or all)
    const restaurants = await this.getVisibleRestaurants(managedIds);
    const restIds = restaurants.map(r => r.id);

    // Batch: visits, sessions, and meetings in parallel
    let visitsQuery = client
      .from('lingtin_visit_records')
      .select('restaurant_id, visit_date, visit_period, sentiment_score, keywords')
      .gte('visit_date', startDate)
      .lte('visit_date', endDate)
      .eq('status', 'processed');
    let sessionsQuery = client
      .from('lingtin_table_sessions')
      .select('restaurant_id, period')
      .gte('session_date', startDate)
      .lte('session_date', endDate);
    let meetingsQuery = client
      .from('lingtin_meeting_records')
      .select('restaurant_id, meeting_date, ai_summary, action_items, key_decisions')
      .eq('meeting_type', 'daily_review')
      .gte('meeting_date', startDate)
      .lte('meeting_date', endDate)
      .order('meeting_date', { ascending: false });

    if (managedIds) {
      visitsQuery = visitsQuery.in('restaurant_id', restIds);
      sessionsQuery = sessionsQuery.in('restaurant_id', restIds);
      meetingsQuery = meetingsQuery.in('restaurant_id', restIds);
    }

    const [visitsRes, sessionsRes, meetingsRes] = await Promise.all([
      visitsQuery, sessionsQuery, meetingsQuery,
    ]);
    if (visitsRes.error) throw visitsRes.error;
    if (sessionsRes.error) throw sessionsRes.error;
    const allVisits = visitsRes.data || [];
    const allSessions = sessionsRes.data || [];
    const allMeetingsData = meetingsRes.data || [];

    // Pre-index meetings by restaurant for O(1) lookup
    const meetingsByRestaurant = new Map<string, typeof allMeetingsData>();
    for (const m of allMeetingsData) {
      const list = meetingsByRestaurant.get(m.restaurant_id) || [];
      list.push(m);
      meetingsByRestaurant.set(m.restaurant_id, list);
    }

    // Pre-index visits and sessions by restaurant for O(1) lookup
    const visitsByRestaurant = new Map<string, typeof allVisits>();
    for (const v of allVisits) {
      const list = visitsByRestaurant.get(v.restaurant_id) || [];
      list.push(v);
      visitsByRestaurant.set(v.restaurant_id, list);
    }
    const sessionsByRestaurant = new Map<string, typeof allSessions>();
    for (const s of allSessions) {
      const list = sessionsByRestaurant.get(s.restaurant_id) || [];
      list.push(s);
      sessionsByRestaurant.set(s.restaurant_id, list);
    }

    // Calculate per-restaurant stats + review completion in single pass
    let totalVisits = 0;
    let totalSentimentSum = 0;
    let totalSentimentCount = 0;
    const allKeywordsSet = new Set<string>();

    const enrichedStats = (restaurants || []).map((rest) => {
      const restVisits = visitsByRestaurant.get(rest.id) || [];
      const restSessions = sessionsByRestaurant.get(rest.id) || [];

      // Visit count
      const visitCount = restVisits.length;
      totalVisits += visitCount;

      // Average sentiment score
      const sentimentScores = restVisits
        .filter((v) => v.sentiment_score !== null)
        .map((v) => v.sentiment_score);
      const avgSentiment = sentimentScores.length > 0
        ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
        : null;

      if (avgSentiment !== null) {
        totalSentimentSum += avgSentiment * sentimentScores.length;
        totalSentimentCount += sentimentScores.length;
      }

      // Coverage
      const openCount = restSessions.length;
      const coverage = openCount > 0 ? Math.round((visitCount / openCount) * 100) : 0;

      // Recent keywords (flatten and dedupe)
      const keywordsSet = new Set<string>();
      restVisits.forEach((v) => {
        if (Array.isArray(v.keywords)) {
          v.keywords.forEach((kw: string) => {
            if (kw) {
              keywordsSet.add(kw);
              allKeywordsSet.add(kw);
            }
          });
        }
      });

      // Review completion: days with visits that also have a daily_review meeting
      const visitDates = [...new Set(restVisits.map(v => v.visit_date))];
      const restMeetings = meetingsByRestaurant.get(rest.id) || [];
      const meetingDatesSet = new Set(restMeetings.map(m => m.meeting_date));
      const reviewedDays = visitDates.filter(d => meetingDatesSet.has(d)).length;
      const reviewCompletion = visitDates.length > 0
        ? Math.round((reviewedDays / visitDates.length) * 100)
        : 0;

      // Latest daily_review meeting (already ordered by meeting_date desc)
      let latestReview: { ai_summary: string; action_items: string[]; key_decisions: string[] } | null = null;
      if (restMeetings.length > 0) {
        const m = restMeetings[0];
        latestReview = {
          ai_summary: m.ai_summary || '',
          action_items: m.action_items || [],
          key_decisions: m.key_decisions || [],
        };
      }

      return {
        id: rest.id,
        name: rest.restaurant_name,
        visit_count: visitCount,
        open_count: openCount,
        coverage,
        avg_sentiment: avgSentiment !== null ? Math.round(avgSentiment * 100) / 100 : null,
        keywords: [...keywordsSet].slice(0, 5),
        review_completion: reviewCompletion,
        latest_review: latestReview,
      };
    });

    // Sort by visit count descending
    enrichedStats.sort((a, b) => b.visit_count - a.visit_count);

    return {
      summary: {
        total_visits: totalVisits,
        avg_sentiment: totalSentimentCount > 0
          ? Math.round((totalSentimentSum / totalSentimentCount) * 100) / 100
          : null,
        restaurant_count: restaurants?.length || 0,
      },
      restaurants: enrichedStats,
      recent_keywords: [...allKeywordsSet].slice(0, 10),
    };
  }

  // Get manager questions used in date range (simple list)
  async getSpeechHighlights(restaurantId: string, startDate: string, endDate: string) {
    if (this.supabase.isMockMode()) {
      return {
        questions: [
          { text: '今天的菜品口味还满意吗？', table: 'A3', time: '12:15' },
          { text: '请问是第几次来我们店？', table: 'B1', time: '12:30' },
          { text: '有什么需要改进的地方吗？', table: 'A5', time: '18:45' },
        ],
      };
    }
    const client = this.supabase.getClient();

    // Get all records with manager questions
    const { data, error } = await client
      .from('lingtin_visit_records')
      .select('table_id, manager_questions, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('visit_date', startDate)
      .lte('visit_date', endDate)
      .eq('status', 'processed')
      .not('manager_questions', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    // Format as simple list of questions with table and time
    const questions: { text: string; table: string; time: string }[] = [];

    data?.forEach((record) => {
      const managerQuestions = record.manager_questions || [];
      if (managerQuestions.length > 0) {
        const time = new Date(record.created_at).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        managerQuestions.forEach((question: string) => {
          if (question && question.trim()) {
            questions.push({
              text: question,
              table: record.table_id,
              time,
            });
          }
        });
      }
    });

    return { questions: questions.slice(0, 6) };
  }

  // Get restaurant detail with visit records for a specific date
  async getRestaurantDetail(restaurantId: string, date: string) {
    const client = this.supabase.getClient();

    // Parallel: restaurant info + visit records
    const [restRes, visitsRes] = await Promise.all([
      client
        .from('master_restaurant')
        .select('id, restaurant_name')
        .eq('id', restaurantId)
        .single(),
      client
        .from('lingtin_visit_records')
        .select('id, table_id, visit_period, sentiment_score, ai_summary, keywords, manager_questions, customer_answers, corrected_transcript, created_at')
        .eq('restaurant_id', restaurantId)
        .eq('visit_date', date)
        .eq('status', 'processed')
        .order('created_at', { ascending: false }),
    ]);

    if (restRes.error) throw restRes.error;
    if (visitsRes.error) throw visitsRes.error;
    const restaurant = restRes.data;
    const visits = visitsRes.data;

    // Calculate summary
    const sentimentScores = (visits || [])
      .filter((v) => v.sentiment_score !== null)
      .map((v) => v.sentiment_score);
    const avgSentiment = sentimentScores.length > 0
      ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
      : null;

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.restaurant_name,
      },
      visits: visits || [],
      summary: {
        total_visits: visits?.length || 0,
        avg_sentiment: avgSentiment !== null ? Math.round(avgSentiment * 100) / 100 : null,
      },
    };
  }

  // Get daily briefing for admin: cross-restaurant anomaly detection + problem cards
  async getBriefing(startDate: string, endDate: string, managedIds: string[] | null = null) {
    if (this.supabase.isMockMode()) {
      return {
        date: startDate,
        greeting: this.getGreeting(),
        problems: [
          {
            severity: 'red' as BriefingSeverity,
            category: 'dish_quality' as BriefingCategory,
            restaurantId: 'mock-rest-1',
            restaurantName: '望京旗舰店',
            title: '🍳 菜品差评（3桌）',
            evidence: [
              { text: '酸汤鱼感觉咽不下去，太酸了', tableId: 'B6', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', managerQuestions: ['今天这道酸汤鱼觉得怎么样？', '辣度可以吗？'], customerAnswers: ['太酸了，感觉咽不下去', '辣度还行，就是酸味太重'] },
              { text: '红烧肉太油腻，吃不了几块', tableId: 'A2', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', managerQuestions: ['红烧肉还合口味吗？'], customerAnswers: ['太油腻了，吃不了几块'] },
              { text: '糖醋排骨偏甜，糖放多了', tableId: 'C1', audioUrl: null, managerQuestions: ['排骨味道怎么样？'], customerAnswers: ['偏甜了，糖放多了吧'] },
            ],
          },
          {
            severity: 'yellow' as BriefingSeverity,
            category: 'service_speed' as BriefingCategory,
            restaurantId: 'mock-rest-2',
            restaurantName: '三里屯店',
            title: '⏱️ 上菜速度投诉（2桌）',
            evidence: [
              { text: '等了40分钟还没上齐', tableId: 'A5', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', managerQuestions: ['今天用餐体验怎么样？'], customerAnswers: ['等太久了，40分钟菜还没上齐'] },
              { text: '催了两次才上菜', tableId: 'B3', audioUrl: null, managerQuestions: ['菜品口味满意吗？', '上菜速度还可以吗？'], customerAnswers: ['口味不错', '不行，催了两次才上来'] },
            ],
          },
          {
            severity: 'yellow' as BriefingSeverity,
            category: 'coverage' as BriefingCategory,
            restaurantId: 'mock-rest-2',
            restaurantName: '三里屯店',
            title: '桌访覆盖率偏低',
            evidence: [],
            metric: '覆盖率 55%',
          },
        ],
        healthy_count: 1,
        restaurant_count: 3,
        avg_sentiment: 68,
        avg_coverage: 78,
        avg_review_completion: 65,
      };
    }

    const client = this.supabase.getClient();

    // 1. Get visible restaurants (scoped or all)
    const restaurants = await this.getVisibleRestaurants(managedIds);
    if (restaurants.length === 0) {
      return { date: startDate, greeting: this.getGreeting(), problems: [], healthy_count: 0, restaurant_count: 0, avg_sentiment: null, avg_coverage: 0, avg_review_completion: 0 };
    }

    const restMap = new Map(restaurants.map(r => [r.id, r.restaurant_name]));
    const restIds = restaurants.map(r => r.id);

    // 2. Fetch visit records, action items, table sessions, and yesterday's data in parallel
    const isMultiDay = startDate !== endDate;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toChinaDateString(yesterday);

    // Build scoped queries
    let visitsQ = client.from('lingtin_visit_records')
      .select('id, restaurant_id, table_id, visit_date, feedbacks, sentiment_score, audio_url, keywords, status, manager_questions, customer_answers')
      .gte('visit_date', startDate)
      .lte('visit_date', endDate)
      .eq('status', 'processed');
    let actionsQ = client.from('lingtin_action_items')
      .select('id, restaurant_id, category, suggestion_text, priority, status, created_at')
      .in('status', ['pending', 'acknowledged'])
      .eq('priority', 'high');
    let sessionsQ = client.from('lingtin_table_sessions')
      .select('restaurant_id, period')
      .gte('session_date', startDate)
      .lte('session_date', endDate);
    // Skip yesterday comparison for multi-day ranges (meaningless)
    let yesterdayQ = client.from('lingtin_visit_records')
      .select('restaurant_id, sentiment_score')
      .eq('visit_date', isMultiDay ? '1970-01-01' : yesterdayStr)
      .eq('status', 'processed');
    // Batch: daily_review meetings for review completion (replaces per-store getReviewCompletionStats)
    let meetingsQ = client.from('lingtin_meeting_records')
      .select('restaurant_id, meeting_date')
      .eq('meeting_type', 'daily_review')
      .gte('meeting_date', startDate)
      .lte('meeting_date', endDate);

    if (managedIds) {
      visitsQ = visitsQ.in('restaurant_id', restIds);
      actionsQ = actionsQ.in('restaurant_id', restIds);
      sessionsQ = sessionsQ.in('restaurant_id', restIds);
      yesterdayQ = yesterdayQ.in('restaurant_id', restIds);
      meetingsQ = meetingsQ.in('restaurant_id', restIds);
    }

    const [visitsRes, actionsRes, sessionsRes, yesterdayVisitsRes, meetingsRes] = await Promise.all([
      visitsQ, actionsQ, sessionsQ, yesterdayQ, meetingsQ,
    ]);

    const visits = visitsRes.data || [];
    const actions = actionsRes.data || [];
    const sessions = sessionsRes.data || [];
    const yesterdayVisits = isMultiDay ? [] : (yesterdayVisitsRes.data || []);
    const allMeetings = meetingsRes.data || [];

    // Pre-compute review meeting dates per restaurant for in-memory review completion
    const meetingDatesByRestaurant = new Map<string, Set<string>>();
    for (const m of allMeetings) {
      const dates = meetingDatesByRestaurant.get(m.restaurant_id) || new Set<string>();
      dates.add(m.meeting_date);
      meetingDatesByRestaurant.set(m.restaurant_id, dates);
    }

    // 3. Per-restaurant anomaly detection
    const problems: BriefingProblem[] = [];
    let totalSentimentSum = 0;
    let totalSentimentCount = 0;
    let totalOpen = 0;
    let totalVisit = 0;
    const perRestCompletionRates: number[] = []; // collect for avg computation

    for (const rest of restaurants) {
      const restVisits = visits.filter(v => v.restaurant_id === rest.id);
      const restSessions = sessions.filter(s => s.restaurant_id === rest.id);
      const restYesterdayVisits = yesterdayVisits.filter(v => v.restaurant_id === rest.id);

      // Aggregate sentiment
      const scores = restVisits.filter(v => v.sentiment_score !== null).map(v => v.sentiment_score);
      const avgSentiment = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      if (avgSentiment !== null) {
        totalSentimentSum += avgSentiment * scores.length;
        totalSentimentCount += scores.length;
      }

      // Coverage
      const openCount = restSessions.length;
      const visitCount = restVisits.length;
      totalOpen += openCount;
      totalVisit += visitCount;
      const coverage = openCount > 0 ? Math.round((visitCount / openCount) * 100) : 0;

      // --- Anomaly: no visits ---
      if (restVisits.length === 0 && openCount > 0) {
        problems.push({
          severity: 'yellow',
          category: 'no_visits',
          restaurantId: rest.id,
          restaurantName: rest.restaurant_name,
          title: '当天无桌访记录',
          evidence: [],
          metric: `开台 ${openCount} 桌，0 条桌访`,
        });
        continue;
      }

      // --- Anomaly: low sentiment ---
      if (avgSentiment !== null && avgSentiment < 50) {
        problems.push({
          severity: 'red',
          category: 'sentiment',
          restaurantId: rest.id,
          restaurantName: rest.restaurant_name,
          title: '整体满意度偏低',
          evidence: [],
          metric: `日均满意度 ${Math.round(avgSentiment)}`,
        });
      }

      // --- Anomaly: low coverage (kept for when table_sessions has data) ---
      if (openCount > 0 && coverage < 70) {
        const yesterdayCount = restYesterdayVisits.length;
        const diffText = yesterdayCount > visitCount
          ? `昨日 ${yesterdayCount} 条，今日 ${visitCount} 条`
          : `覆盖率 ${coverage}%`;
        problems.push({
          severity: 'yellow',
          category: 'coverage',
          restaurantId: rest.id,
          restaurantName: rest.restaurant_name,
          title: '桌访覆盖率偏低',
          evidence: [],
          metric: diffText,
        });
      }

      // --- Anomaly: low review completion (< 50%) — computed in-memory ---
      {
        const visitDates = [...new Set(restVisits.map(v => v.visit_date))];
        const reviewDates = meetingDatesByRestaurant.get(rest.id) || new Set<string>();
        const totalDays = visitDates.length;
        const reviewedDays = visitDates.filter(d => reviewDates.has(d)).length;
        const completionRate = totalDays > 0 ? Math.round((reviewedDays / totalDays) * 100) : 0;
        if (totalDays > 0) {
          perRestCompletionRates.push(completionRate);
          if (completionRate < 50) {
            problems.push({
              severity: completionRate < 30 ? 'red' : 'yellow',
              category: 'review_completion',
              restaurantId: rest.id,
              restaurantName: rest.restaurant_name,
              title: '复盘执行不足',
              evidence: [],
              metric: `复盘完成率 ${completionRate}%（${reviewedDays}/${totalDays}天）`,
            });
          }
        }
      }

      // --- Anomaly: negative feedbacks by category ---
      // Collect all negative feedbacks with category detection
      const categoryFeedbacks = new Map<BriefingCategory, { text: string; tableId: string; audioUrl: string | null; managerQuestions: string[]; customerAnswers: string[] }[]>();

      for (const visit of restVisits) {
        const feedbacks = visit.feedbacks || [];
        const keywords = visit.keywords || [];

        for (const fb of feedbacks) {
          if (typeof fb === 'object' && fb.sentiment === 'negative' && fb.text) {
            const cat = this.detectFeedbackCategory(fb.text, keywords);
            const existing = categoryFeedbacks.get(cat) || [];
            existing.push({
              text: fb.text,
              tableId: visit.table_id,
              audioUrl: visit.audio_url || null,
              managerQuestions: visit.manager_questions || [],
              customerAnswers: visit.customer_answers || [],
            });
            categoryFeedbacks.set(cat, existing);
          }
        }
      }

      // Generate problem cards for categories with ≥2 negative feedbacks
      for (const [cat, items] of categoryFeedbacks) {
        if (items.length >= 2) {
          const catLabels: Record<BriefingCategory, string> = {
            dish_quality: '菜品差评',
            service_speed: '上菜速度投诉',
            staff_attitude: '服务态度问题',
            environment: '环境问题',
            coverage: '', review_completion: '', sentiment: '', no_visits: '', action_overdue: '',
          };
          const catIcons: Record<BriefingCategory, string> = {
            dish_quality: '🍳', service_speed: '⏱️', staff_attitude: '😐', environment: '🏠',
            coverage: '', review_completion: '', sentiment: '', no_visits: '', action_overdue: '',
          };
          problems.push({
            severity: items.length >= 3 ? 'red' : 'yellow',
            category: cat,
            restaurantId: rest.id,
            restaurantName: rest.restaurant_name,
            title: `${catIcons[cat] || ''} ${catLabels[cat] || cat}（${items.length}桌）`,
            evidence: items.slice(0, 3),
          });
        }
      }

      // --- Anomaly: overdue high-priority actions ---
      const restOverdue = actions.filter(a => {
        if (a.restaurant_id !== rest.id) return false;
        const created = new Date(a.created_at);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff > 3;
      });
      if (restOverdue.length > 0) {
        problems.push({
          severity: 'yellow',
          category: 'action_overdue',
          restaurantId: rest.id,
          restaurantName: rest.restaurant_name,
          title: `${restOverdue.length} 条高优先级建议超 3 天未处理`,
          evidence: [],
        });
      }
    }

    // Sort problems: red first, then yellow; within same severity by evidence count desc
    problems.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'red' ? -1 : 1;
      return b.evidence.length - a.evidence.length;
    });

    const healthyCount = restaurants.length - new Set(problems.map(p => p.restaurantId)).size;
    const overallAvgSentiment = totalSentimentCount > 0
      ? Math.round((totalSentimentSum / totalSentimentCount) * 100) / 100
      : null;
    const overallCoverage = totalOpen > 0 ? Math.round((totalVisit / totalOpen) * 100) : 0;

    // Avg review completion — reuse rates collected in the per-restaurant loop above
    const avgReviewCompletion = perRestCompletionRates.length > 0
      ? Math.round(perRestCompletionRates.reduce((a, b) => a + b, 0) / perRestCompletionRates.length)
      : 0;

    return {
      date: startDate,
      greeting: this.getGreeting(),
      problems,
      healthy_count: healthyCount,
      restaurant_count: restaurants.length,
      avg_sentiment: overallAvgSentiment,
      avg_coverage: overallCoverage,
      avg_review_completion: avgReviewCompletion,
    };
  }

  // Detect feedback category from text and keywords
  private detectFeedbackCategory(text: string, keywords: string[]): BriefingCategory {
    const lower = text.toLowerCase();
    const allText = [lower, ...keywords.map(k => k.toLowerCase())].join(' ');

    if (/慢|等了|催|久|速度|出菜/.test(allText)) return 'service_speed';
    if (/态度|不耐烦|冷淡|不理|脸色/.test(allText)) return 'staff_attitude';
    if (/环境|吵|脏|热|冷|味道大|苍蝇/.test(allText)) return 'environment';
    return 'dish_quality';
  }

  // Get greeting based on time of day
  private getGreeting(): string {
    const hour = new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai', hour: 'numeric', hour12: false });
    const h = parseInt(hour, 10);
    if (h < 12) return '早安';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  // Get customer suggestions aggregated from feedbacks with sentiment==='suggestion'
  // Supports restaurant_id=all (cross-restaurant) or single restaurant UUID
  async getSuggestions(restaurantId: string, startDateStr: string, endDateStr: string, managedIds: string[] | null = null) {
    if (this.supabase.isMockMode()) {
      return {
        suggestions: [
          {
            text: '希望能加一些辣度选择，比如微辣、中辣、特辣',
            count: 4,
            restaurants: ['望京旗舰店', '三里屯店'],
            evidence: [
              { tableId: 'B2', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', restaurantName: '望京旗舰店', restaurantId: 'mock-rest-1', managerQuestions: ['对菜品有什么建议吗？'], customerAnswers: ['希望能选辣度，我们爱吃辣但有朋友不能吃'] },
              { tableId: 'A7', audioUrl: null, restaurantName: '三里屯店', restaurantId: 'mock-rest-2', managerQuestions: ['有什么改进建议？'], customerAnswers: ['加个辣度选项吧，微辣中辣特辣'] },
              { tableId: 'C3', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', restaurantName: '望京旗舰店', restaurantId: 'mock-rest-1', managerQuestions: ['下次来还想吃什么？', '口味有要调整的吗？'], customerAnswers: ['还想试试水煮鱼', '能不能出个辣度选择？每次都太辣了'] },
            ],
          },
          {
            text: '建议增加儿童餐或小份菜',
            count: 3,
            restaurants: ['望京旗舰店'],
            evidence: [
              { tableId: 'A1', audioUrl: null, restaurantName: '望京旗舰店', restaurantId: 'mock-rest-1', managerQuestions: ['带孩子来用餐方便吗？'], customerAnswers: ['菜量太大了，小朋友吃不完，有儿童餐就好了'] },
              { tableId: 'B5', audioUrl: null, restaurantName: '望京旗舰店', restaurantId: 'mock-rest-1', managerQuestions: ['还有什么需要的吗？'], customerAnswers: ['能不能出小份的，两个人吃不了那么多'] },
            ],
          },
          {
            text: '停车不太方便，能不能和隔壁商场合作停车券',
            count: 2,
            restaurants: ['三里屯店'],
            evidence: [
              { tableId: 'A3', audioUrl: null, restaurantName: '三里屯店', restaurantId: 'mock-rest-2', managerQuestions: ['来店里方便吗？'], customerAnswers: ['开车来的，停车太难了，绕了三圈'] },
            ],
          },
        ],
        by_restaurant: [],
      };
    }

    const client = this.supabase.getClient();

    let query = client
      .from('lingtin_visit_records')
      .select('id, restaurant_id, table_id, feedbacks, audio_url, manager_questions, customer_answers')
      .gte('visit_date', startDateStr)
      .lte('visit_date', endDateStr)
      .eq('status', 'processed');

    if (restaurantId !== 'all') {
      query = query.eq('restaurant_id', restaurantId);
    } else if (managedIds) {
      query = query.in('restaurant_id', managedIds);
    }

    // Parallel: start restaurant lookup alongside the main query when cross-restaurant
    const restaurantsPromise = restaurantId === 'all'
      ? this.getVisibleRestaurants(managedIds)
      : Promise.resolve(null);

    const [{ data, error }, restaurants] = await Promise.all([query, restaurantsPromise]);
    if (error) throw error;

    // Build restaurant name lookup if cross-restaurant
    const restMap = restaurants
      ? new Map(restaurants.map(r => [r.id, r.restaurant_name]))
      : new Map<string, string>();

    // Collect all suggestion feedbacks
    const suggestionMap = new Map<string, {
      count: number;
      restaurants: Set<string>;
      evidence: { tableId: string; audioUrl: string | null; restaurantName: string; restaurantId: string; managerQuestions: string[]; customerAnswers: string[] }[];
    }>();

    for (const record of (data || [])) {
      const feedbacks = record.feedbacks || [];
      for (const fb of feedbacks) {
        if (typeof fb === 'object' && fb.sentiment === 'suggestion' && fb.text) {
          const existing = suggestionMap.get(fb.text) || {
            count: 0,
            restaurants: new Set<string>(),
            evidence: [],
          };
          existing.count++;
          const restName = restMap.get(record.restaurant_id) || '';
          existing.restaurants.add(restName || record.restaurant_id);
          if (existing.evidence.length < 3) {
            existing.evidence.push({
              tableId: record.table_id,
              audioUrl: record.audio_url || null,
              restaurantName: restName,
              restaurantId: record.restaurant_id,
              managerQuestions: record.manager_questions || [],
              customerAnswers: record.customer_answers || [],
            });
          }
          suggestionMap.set(fb.text, existing);
        }
      }
    }

    // Sort by count descending
    const suggestions = Array.from(suggestionMap.entries())
      .map(([text, data]) => ({
        text,
        count: data.count,
        restaurants: Array.from(data.restaurants),
        evidence: data.evidence,
      }))
      .sort((a, b) => b.count - a.count);

    // Group suggestions by restaurant
    const byRestMap = new Map<string, {
      restaurant_id: string;
      restaurant_name: string;
      suggestions: typeof suggestions;
    }>();

    for (const sug of suggestions) {
      for (const ev of sug.evidence) {
        const rid = ev.restaurantId;
        if (!byRestMap.has(rid)) {
          byRestMap.set(rid, {
            restaurant_id: rid,
            restaurant_name: ev.restaurantName || restMap.get(rid) || rid,
            suggestions: [],
          });
        }
        const entry = byRestMap.get(rid)!;
        // Add suggestion with evidence filtered to this restaurant only
        if (!entry.suggestions.find(s => s.text === sug.text)) {
          const filteredEvidence = sug.evidence.filter(e => e.restaurantId === rid);
          entry.suggestions.push({
            ...sug,
            evidence: filteredEvidence,
            count: filteredEvidence.length,
          });
        }
      }
    }

    const by_restaurant = Array.from(byRestMap.values())
      .sort((a, b) => b.suggestions.length - a.suggestions.length);

    return { suggestions, by_restaurant };
  }

  // Get cumulative motivation stats for a restaurant (all-time totals)
  async getMotivationStats(restaurantId: string) {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const DEFAULT_RESTAURANT_ID = '0b9e9031-4223-4124-b633-e3a853abfb8f';
    const safeId = UUID_REGEX.test(restaurantId) ? restaurantId : DEFAULT_RESTAURANT_ID;

    if (this.supabase.isMockMode()) {
      return { total_visits: 156, positive_count: 139, resolved_issues: 23 };
    }

    const client = this.supabase.getClient();

    // Run three counts in parallel
    const [visitsResult, positiveResult, resolvedResult] = await Promise.all([
      client
        .from('lingtin_visit_records')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', safeId)
        .eq('status', 'processed'),
      client
        .from('lingtin_visit_records')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', safeId)
        .eq('status', 'processed')
        .gte('sentiment_score', 80),
      client
        .from('lingtin_action_items')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', safeId)
        .eq('status', 'resolved'),
    ]);

    return {
      total_visits: visitsResult.count ?? 0,
      positive_count: positiveResult.count ?? 0,
      resolved_issues: resolvedResult.count ?? 0,
    };
  }

  // Benchmark: compare managed region vs company-wide, detect signals, surface highlights
  async getBenchmark(managedIds: string[], days: number) {
    const client = this.supabase.getClient();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    const startStr = toChinaDateString(startDate);
    const endStr = toChinaDateString(endDate);

    // Fetch all active restaurants and the managed subset
    const { data: allRestaurants } = await client
      .from('master_restaurant')
      .select('id, restaurant_name')
      .eq('is_active', true);
    const allRest = allRestaurants || [];
    const managedRest = allRest.filter(r => managedIds.includes(r.id));
    const restNameMap = new Map(allRest.map(r => [r.id, r.restaurant_name]));

    // Fetch data in parallel: visits, sessions, action items, meetings for the period
    const [allVisitsRes, allSessionsRes, allActionsRes, allMeetingsRes] = await Promise.all([
      client.from('lingtin_visit_records')
        .select('restaurant_id, visit_date, sentiment_score')
        .gte('visit_date', startStr)
        .lte('visit_date', endStr)
        .eq('status', 'processed'),
      client.from('lingtin_table_sessions')
        .select('restaurant_id, session_date')
        .gte('session_date', startStr)
        .lte('session_date', endStr),
      client.from('lingtin_action_items')
        .select('id, restaurant_id, status, priority, created_at')
        .in('status', ['pending', 'acknowledged', 'resolved']),
      client.from('lingtin_meeting_records')
        .select('restaurant_id, meeting_date')
        .eq('meeting_type', 'daily_review')
        .gte('meeting_date', startStr)
        .lte('meeting_date', endStr),
    ]);

    const allVisits = allVisitsRes.data || [];
    const allSessions = allSessionsRes.data || [];
    const allActions = allActionsRes.data || [];
    const allMeetings = allMeetingsRes.data || [];

    // --- Comparison: my region vs company ---
    const calcMetrics = (restIds: string[]) => {
      const visits = allVisits.filter(v => restIds.includes(v.restaurant_id));
      const sessions = allSessions.filter(s => restIds.includes(s.restaurant_id));
      const actions = allActions.filter(a => restIds.includes(a.restaurant_id));
      const meetings = allMeetings.filter(m => restIds.includes(m.restaurant_id));

      const scores = visits.filter(v => v.sentiment_score !== null).map(v => v.sentiment_score);
      const avgSentiment = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const coverage = sessions.length > 0 ? Math.round((visits.length / sessions.length) * 100) : 0;
      const total = actions.length;
      const resolved = actions.filter(a => a.status === 'resolved').length;
      const completionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

      // Review completion: days with visits that also have a daily_review meeting
      const visitDates = [...new Set(visits.map(v => v.visit_date))];
      const meetingDates = new Set(meetings.map(m => m.meeting_date));
      const reviewedDays = visitDates.filter(d => meetingDates.has(d)).length;
      const reviewCompletion = visitDates.length > 0 ? Math.round((reviewedDays / visitDates.length) * 100) : 0;

      return { sentiment: Math.round(avgSentiment * 100) / 100, coverage, actionCompletionRate: completionRate, reviewCompletion };
    };

    const myIds = managedIds;
    const companyIds = allRest.map(r => r.id);
    const mine = calcMetrics(myIds);
    const company = calcMetrics(companyIds);

    // --- Smart Signals ---
    type AlertType = 'execution_gap' | 'trend_decline' | 'unresolved_issue';
    type AlertSeverity = 'high' | 'medium';
    const alerts: { type: AlertType; severity: AlertSeverity; storeName: string; storeId: string; message: string }[] = [];

    for (const rest of managedRest) {
      const restVisits = allVisits.filter(v => v.restaurant_id === rest.id);

      // Execution gap: consecutive days without visits
      const visitDates = new Set(restVisits.map(v => v.visit_date));
      let consecutiveNoVisit = 0;
      for (let d = new Date(endDate); d >= startDate; d.setDate(d.getDate() - 1)) {
        const dateStr = toChinaDateString(d);
        if (!visitDates.has(dateStr)) {
          consecutiveNoVisit++;
        } else {
          break;
        }
      }
      if (consecutiveNoVisit >= 2) {
        alerts.push({
          type: 'execution_gap',
          severity: 'high',
          storeName: rest.restaurant_name,
          storeId: rest.id,
          message: `连续 ${consecutiveNoVisit} 天未进行桌访`,
        });
      }

      // Overdue high-priority actions
      const restOverdue = allActions.filter(a => {
        if (a.restaurant_id !== rest.id || a.priority !== 'high') return false;
        if (a.status === 'resolved') return false;
        const created = new Date(a.created_at);
        const daysDiff = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff > 3;
      });
      if (restOverdue.length > 0) {
        alerts.push({
          type: 'execution_gap',
          severity: 'high',
          storeName: rest.restaurant_name,
          storeId: rest.id,
          message: `${restOverdue.length} 条高优待办超 3 天未处理`,
        });
      }

      // Trend decline: sentiment dropping 3 consecutive days
      const dateScores = new Map<string, number[]>();
      restVisits.forEach(v => {
        if (v.sentiment_score !== null) {
          const scores = dateScores.get(v.visit_date) || [];
          scores.push(v.sentiment_score);
          dateScores.set(v.visit_date, scores);
        }
      });
      const sortedDates = Array.from(dateScores.keys()).sort().slice(-4);
      if (sortedDates.length >= 3) {
        const avgs = sortedDates.map(d => {
          const s = dateScores.get(d)!;
          return s.reduce((a, b) => a + b, 0) / s.length;
        });
        const lastThree = avgs.slice(-3);
        if (lastThree.length === 3 && lastThree[0] > lastThree[1] && lastThree[1] > lastThree[2]) {
          alerts.push({
            type: 'trend_decline',
            severity: 'high',
            storeName: rest.restaurant_name,
            storeId: rest.id,
            message: `满意度连续 3 天下降（${lastThree.map(v => Math.round(v)).join(' → ')}）`,
          });
        }
      }
    }

    // --- Highlights: best performers across all company stores ---
    type HighlightType = 'sentiment_leader' | 'improvement_fastest' | 'completion_best';
    const highlights: { type: HighlightType; storeName: string; storeId: string; metricValue: number; description: string; isMyStore: boolean }[] = [];

    // Sentiment leaders
    const storeMetrics = allRest.map(r => {
      const visits = allVisits.filter(v => v.restaurant_id === r.id);
      const scores = visits.filter(v => v.sentiment_score !== null).map(v => v.sentiment_score);
      const avg = scores.length >= 3 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

      const actions = allActions.filter(a => a.restaurant_id === r.id);
      const total = actions.length;
      const resolved = actions.filter(a => a.status === 'resolved').length;
      const completionRate = total >= 3 ? Math.round((resolved / total) * 100) : null;

      return { id: r.id, name: r.restaurant_name, avgSentiment: avg, completionRate, visitCount: visits.length };
    });

    // Best sentiment
    const sortedBySentiment = storeMetrics.filter(s => s.avgSentiment !== null).sort((a, b) => b.avgSentiment! - a.avgSentiment!);
    sortedBySentiment.slice(0, 3).forEach((s, idx) => {
      highlights.push({
        type: 'sentiment_leader',
        storeName: s.name,
        storeId: s.id,
        metricValue: Math.round(s.avgSentiment!),
        description: idx === 0 ? '满意度最高' : `满意度 TOP ${idx + 1}`,
        isMyStore: managedIds.includes(s.id),
      });
    });

    // Best completion rate
    const sortedByCompletion = storeMetrics.filter(s => s.completionRate !== null).sort((a, b) => b.completionRate! - a.completionRate!);
    if (sortedByCompletion.length > 0 && sortedByCompletion[0].completionRate! > 0) {
      highlights.push({
        type: 'completion_best',
        storeName: sortedByCompletion[0].name,
        storeId: sortedByCompletion[0].id,
        metricValue: sortedByCompletion[0].completionRate!,
        description: '待办完成率最高',
        isMyStore: managedIds.includes(sortedByCompletion[0].id),
      });
    }

    return {
      period: { start: startStr, end: endStr },
      comparison: {
        sentiment: { mine: mine.sentiment, company: company.sentiment },
        coverage: { mine: mine.coverage, company: company.coverage },
        reviewCompletion: { mine: mine.reviewCompletion, company: company.reviewCompletion },
        actionCompletionRate: { mine: mine.actionCompletionRate, company: company.actionCompletionRate },
      },
      alerts,
      highlights,
    };
  }

  // --- Customer Profile Analytics ---

  async getCustomerProfile(startDate: string, endDate: string, managedIds: string[] | null = null) {
    if (this.supabase.isMockMode()) {
      return {
        summary: {
          total_visits: 50,
          repeat_ratio: 38,
          frequency: { first: 20, repeat: 12, regular: 7, unknown: 5, no_data: 6 },
          source_distribution: [
            { source: '美团', count: 12, ratio: 30 },
            { source: '朋友介绍', count: 8, ratio: 20 },
            { source: '大众点评', count: 6, ratio: 15 },
          ],
          data_coverage: 42,
        },
        by_restaurant: [],
      };
    }

    const client = this.supabase.getClient();

    // Parallel: restaurants + visit records
    let query = client
      .from('lingtin_visit_records')
      .select('id, restaurant_id, customer_source, visit_frequency')
      .gte('visit_date', startDate)
      .lte('visit_date', endDate)
      .eq('status', 'processed');

    if (managedIds) {
      query = query.in('restaurant_id', managedIds);
    }

    const [restaurants, { data: records, error }] = await Promise.all([
      this.getVisibleRestaurants(managedIds),
      query,
    ]);
    if (error) throw error;

    const restIds = restaurants.map(r => r.id);
    const restMap = new Map(restaurants.map(r => [r.id, r.restaurant_name]));
    const restIdSet = new Set(restIds);

    // Filter to active restaurants only (managedIds may include inactive ones)
    const allRecords = (records || []).filter(r => restIdSet.has(r.restaurant_id));

    // Helper to compute profile stats for a set of records
    const computeStats = (recs: typeof allRecords) => {
      const total = recs.length;
      const freq = { first: 0, repeat: 0, regular: 0, unknown: 0, no_data: 0 };
      const sourceCount = new Map<string, number>();

      for (const r of recs) {
        // Frequency
        if (r.visit_frequency && ['first', 'repeat', 'regular', 'unknown'].includes(r.visit_frequency)) {
          freq[r.visit_frequency as keyof typeof freq]++;
        } else {
          freq.no_data++;
        }
        // Source
        if (r.customer_source) {
          sourceCount.set(r.customer_source, (sourceCount.get(r.customer_source) || 0) + 1);
        }
      }

      const withData = total - freq.no_data;
      const repeatAndRegular = freq.repeat + freq.regular;
      const repeat_ratio = withData > 0 ? Math.round((repeatAndRegular / withData) * 100) : null;
      const data_coverage = total > 0 ? Math.round((withData / total) * 100) : 0;

      // Sort sources by count descending
      const source_distribution = Array.from(sourceCount.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([source, count]) => ({
          source,
          count,
          ratio: withData > 0 ? Math.round((count / withData) * 100) : 0,
        }));

      return { total_visits: total, repeat_ratio, frequency: freq, source_distribution, data_coverage };
    };

    // Compute summary across all records
    const summary = computeStats(allRecords);

    // Compute per-restaurant stats
    const byRestaurantMap = new Map<string, typeof allRecords>();
    for (const r of allRecords) {
      const existing = byRestaurantMap.get(r.restaurant_id) || [];
      existing.push(r);
      byRestaurantMap.set(r.restaurant_id, existing);
    }

    const by_restaurant = restaurants
      .map(rest => {
        const recs = byRestaurantMap.get(rest.id) || [];
        if (recs.length === 0) return null;
        const stats = computeStats(recs);
        return {
          restaurant_id: rest.id,
          restaurant_name: restMap.get(rest.id) || rest.id,
          ...stats,
        };
      })
      .filter(Boolean);

    return { summary, by_restaurant };
  }

  // Execution summary for a single restaurant on a given date
  async getExecutionSummary(restaurantId: string, date: string) {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const DEFAULT_RESTAURANT_ID = '0b9e9031-4223-4124-b633-e3a853abfb8f';
    const safeId = UUID_REGEX.test(restaurantId) ? restaurantId : DEFAULT_RESTAURANT_ID;

    const client = this.supabase.getClient();
    const [reviewResult, pendingResult] = await Promise.all([
      client.from('lingtin_meeting_records')
        .select('id')
        .eq('restaurant_id', safeId)
        .eq('meeting_type', 'daily_review')
        .eq('meeting_date', date)
        .limit(1),
      client.from('lingtin_action_items')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', safeId)
        .eq('status', 'pending'),
    ]);

    return {
      review_done: (reviewResult.data?.length ?? 0) > 0,
      pending_actions: pendingResult.count ?? 0,
    };
  }

  // Execution overview for multiple restaurants (admin/regional manager)
  // Returns brand-grouped data with visit counts and sentiment
  async getMultiExecutionSummary(date: string, managedIds: string[] | null) {
    const restaurants = await this.getVisibleRestaurants(managedIds);
    if (restaurants.length === 0) {
      return { brands: [], restaurants: [], summary: { reviewed_count: 0, total_count: 0, total_pending: 0 } };
    }

    const ids = restaurants.map(r => r.id);
    const client = this.supabase.getClient();

    const [reviewResult, pendingResult, visitsResult] = await Promise.all([
      client.from('lingtin_meeting_records')
        .select('restaurant_id')
        .in('restaurant_id', ids)
        .eq('meeting_type', 'daily_review')
        .eq('meeting_date', date),
      client.from('lingtin_action_items')
        .select('restaurant_id')
        .in('restaurant_id', ids)
        .eq('status', 'pending'),
      client.from('lingtin_visit_records')
        .select('restaurant_id, sentiment_score')
        .in('restaurant_id', ids)
        .gte('visit_date', date)
        .lte('visit_date', date)
        .eq('status', 'processed'),
    ]);

    const reviewedSet = new Set((reviewResult.data || []).map(r => r.restaurant_id));
    const pendingByRestaurant = new Map<string, number>();
    for (const item of (pendingResult.data || [])) {
      pendingByRestaurant.set(item.restaurant_id, (pendingByRestaurant.get(item.restaurant_id) || 0) + 1);
    }
    // Visit counts and avg sentiment per restaurant
    const visitsByRestaurant = new Map<string, number>();
    const sentimentByRestaurant = new Map<string, number[]>();
    for (const v of (visitsResult.data || [])) {
      visitsByRestaurant.set(v.restaurant_id, (visitsByRestaurant.get(v.restaurant_id) || 0) + 1);
      if (v.sentiment_score != null) {
        const scores = sentimentByRestaurant.get(v.restaurant_id) || [];
        scores.push(v.sentiment_score);
        sentimentByRestaurant.set(v.restaurant_id, scores);
      }
    }

    // Build per-restaurant result with brand info
    const allRestaurants = restaurants.map(r => {
      const scores = sentimentByRestaurant.get(r.id) || [];
      const avgSentiment = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      // Short name: remove brand prefix from restaurant_name
      const shortName = r.brand_name && r.restaurant_name.startsWith(r.brand_name)
        ? r.restaurant_name.slice(r.brand_name.length)
        : r.restaurant_name;
      return {
        id: r.id,
        name: shortName,
        full_name: r.restaurant_name,
        brand_id: r.brand_id,
        brand_name: r.brand_name,
        review_done: reviewedSet.has(r.id),
        pending_actions: pendingByRestaurant.get(r.id) || 0,
        visit_count: visitsByRestaurant.get(r.id) || 0,
        avg_sentiment: avgSentiment,
      };
    });

    // Group by brand
    const brandMap = new Map<number | null, typeof allRestaurants>();
    for (const r of allRestaurants) {
      const key = r.brand_id;
      const group = brandMap.get(key) || [];
      group.push(r);
      brandMap.set(key, group);
    }

    const brands = Array.from(brandMap.entries()).map(([brandId, rests]) => {
      const brandName = rests[0]?.brand_name || '其他';
      const reviewed = rests.filter(r => r.review_done).length;
      return {
        brand_id: brandId,
        brand_name: brandName,
        restaurants: rests,
        summary: {
          reviewed_count: reviewed,
          total_count: rests.length,
          total_pending: rests.reduce((s, r) => s + r.pending_actions, 0),
        },
      };
    });

    // Flat restaurants list for backward compat
    const flatResult = allRestaurants.map(r => ({
      id: r.id,
      name: r.full_name,
      review_done: r.review_done,
      pending_actions: r.pending_actions,
    }));

    return {
      brands,
      restaurants: flatResult,
      summary: {
        reviewed_count: allRestaurants.filter(r => r.review_done).length,
        total_count: allRestaurants.length,
        total_pending: allRestaurants.reduce((sum, r) => sum + r.pending_actions, 0),
      },
    };
  }
}
