import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../../common/supabase/supabase.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_RESTAURANT_ID = '0b9e9031-4223-4124-b633-e3a853abfb8f';

const MAX_EVIDENCE = 20;
const MAX_KEYWORDS = 20;
const DAILY_COUNTS_WINDOW = 14;

// 厨房相关的 category
const KITCHEN_CATEGORIES = ['dish_quality', 'service_speed'];
const KITCHEN_KEYWORDS = [
  '菜', '味', '咸', '淡', '辣', '酸', '甜', '苦', '油', '腻',
  '凉', '冷', '热', '生', '熟', '硬', '软', '烂', '糊', '焦',
  '上菜', '出菜', '等菜', '催菜', '慢', '快', '温度', '分量',
  '口感', '口味', '味道', '调料', '食材', '新鲜', '变质',
];

interface FeedbackItem {
  text: string;
  sentiment: string;
  score: number;
  category?: string;
}

interface VisitRecordForAggregation {
  id: string;
  restaurant_id: string;
  table_id?: string;
  audio_url?: string;
  feedbacks: FeedbackItem[];
  created_at: string;
}

@Injectable()
export class FeedbackIssuesService {
  private readonly logger = new Logger(FeedbackIssuesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 实时聚合：AI 分析完一条录音后立即调用
   */
  async aggregateSingleVisit(visit: VisitRecordForAggregation): Promise<void> {
    if (this.supabase.isMockMode()) return;
    if (!visit.feedbacks?.length) return;

    const safeRestaurantId = UUID_REGEX.test(visit.restaurant_id)
      ? visit.restaurant_id
      : DEFAULT_RESTAURANT_ID;

    const client = this.supabase.getClient();
    const visitDate = visit.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);

    // Load existing issues for this restaurant
    const { data: existingIssues } = await client
      .from('lingtin_feedback_issues')
      .select('id, topic, topic_keywords, category, occurrence_count, evidence, daily_counts')
      .eq('restaurant_id', safeRestaurantId);

    for (const fb of visit.feedbacks) {
      if (!fb.text?.trim()) continue;

      const category = this.inferCategory(fb);
      const evidenceEntry = {
        visit_record_id: visit.id,
        feedback_text: fb.text,
        table_id: visit.table_id || null,
        date: visitDate,
        audio_url: visit.audio_url || null,
        sentiment: fb.sentiment,
        score: fb.score,
      };

      // Try to match existing issue
      const match = this.findMatchingIssue(fb.text, category, existingIssues || []);

      if (match) {
        await this.updateExistingIssue(client, match, fb.text, evidenceEntry, visitDate);
      } else {
        const newIssue = await this.createNewIssue(
          client, safeRestaurantId, category, fb.text, evidenceEntry, visitDate,
        );
        // Add to in-memory list for subsequent feedback matching in this visit
        if (newIssue) {
          existingIssues?.push({
            id: newIssue.id,
            topic: fb.text,
            topic_keywords: [],
            category,
            occurrence_count: 1,
            evidence: [evidenceEntry],
            daily_counts: [{ date: visitDate, count: 1 }],
          });
        }
      }
    }
  }

  /**
   * 每日 21:05 UTC+8 更新 daily_counts 趋势 + 补漏
   */
  @Cron('0 5 13 * * *', { name: 'feedback-issues-daily-rollup' })
  async handleDailyRollup(): Promise<void> {
    this.logger.log('Cron: 反馈聚合每日滚动更新 (21:05 UTC+8)');
    if (this.supabase.isMockMode()) {
      this.logger.log('Cron: Mock mode, skipping');
      return;
    }
    await this.runDailyRollup();
  }

  async runDailyRollup(): Promise<{ updated: number }> {
    const client = this.supabase.getClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAILY_COUNTS_WINDOW);

    // Get all issues
    const { data: issues, error } = await client
      .from('lingtin_feedback_issues')
      .select('id, daily_counts');
    if (error) throw error;

    let updated = 0;
    for (const issue of issues || []) {
      const counts = (issue.daily_counts || []) as Array<{ date: string; count: number }>;
      // Trim to 14-day window
      const trimmed = counts.filter(
        (d) => new Date(d.date) >= cutoffDate,
      );
      if (trimmed.length !== counts.length) {
        await client
          .from('lingtin_feedback_issues')
          .update({ daily_counts: trimmed, updated_at: new Date().toISOString() })
          .eq('id', issue.id);
        updated++;
      }
    }

    this.logger.log(`Daily rollup: trimmed ${updated} issues`);
    return { updated };
  }

  /**
   * 查询 issues 列表
   */
  async getIssues(
    restaurantId: string,
    filters?: {
      classification?: string;
      category?: string;
      role?: string;
      limit?: number;
    },
  ) {
    if (this.supabase.isMockMode()) {
      return { issues: [] };
    }

    const safeRestaurantId = UUID_REGEX.test(restaurantId)
      ? restaurantId
      : DEFAULT_RESTAURANT_ID;

    const client = this.supabase.getClient();
    let query = client
      .from('lingtin_feedback_issues')
      .select('*')
      .eq('restaurant_id', safeRestaurantId)
      .order('last_seen_at', { ascending: false });

    if (filters?.classification) {
      query = query.eq('classification', filters.classification);
    }

    if (filters?.category) {
      const categories = filters.category.split(',');
      query = query.in('category', categories);
    }

    // Chef role filter: kitchen-relevant categories + keyword matching
    if (filters?.role === 'head_chef') {
      query = query.in('category', KITCHEN_CATEGORIES);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    return { issues: data || [] };
  }

  /**
   * 管理层跨门店概览
   */
  async getManagementSummary(managedIds?: string[]) {
    if (this.supabase.isMockMode()) {
      return { restaurants: [] };
    }

    const client = this.supabase.getClient();
    let query = client
      .from('lingtin_feedback_issues')
      .select('restaurant_id, classification, manager_classification, chef_classification, manager_action_at, chef_action_at, management_reply, management_reply_read_by_manager, management_reply_read_by_chef');

    if (managedIds?.length) {
      query = query.in('restaurant_id', managedIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Group by restaurant
    const restaurantMap = new Map<string, typeof data>();
    for (const issue of data || []) {
      const list = restaurantMap.get(issue.restaurant_id) || [];
      list.push(issue);
      restaurantMap.set(issue.restaurant_id, list);
    }

    // Get restaurant names
    const restaurantIds = Array.from(restaurantMap.keys());
    let restaurantNames: Record<string, string> = {};
    if (restaurantIds.length > 0) {
      const { data: restaurants } = await client
        .from('master_restaurant')
        .select('id, restaurant_name')
        .in('id', restaurantIds);
      for (const r of restaurants || []) {
        restaurantNames[r.id] = r.restaurant_name;
      }
    }

    const restaurants = Array.from(restaurantMap.entries()).map(([rid, issues]) => {
      const breakdown = { unclassified: 0, resolved: 0, todo: 0, dismissed: 0 };
      let staffActionsCount = 0;
      let todoOverdueCount = 0;
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      for (const issue of issues) {
        const cls = issue.classification as keyof typeof breakdown;
        if (cls in breakdown) breakdown[cls]++;
        if (issue.manager_action_at || issue.chef_action_at) staffActionsCount++;
        if (
          issue.classification === 'todo' &&
          issue.manager_action_at &&
          new Date(issue.manager_action_at) < threeDaysAgo
        ) {
          todoOverdueCount++;
        }
      }

      return {
        restaurant_id: rid,
        restaurant_name: restaurantNames[rid] || rid,
        issues_total: issues.length,
        issues_breakdown: breakdown,
        staff_actions_count: staffActionsCount,
        todo_overdue_count: todoOverdueCount,
      };
    });

    return { restaurants };
  }

  /**
   * 管理层原始数据+操作叠加时间线
   */
  async getRawTimeline(restaurantId: string, dateRange?: { start: string; end: string }) {
    if (this.supabase.isMockMode()) {
      return { issues: [] };
    }

    const safeRestaurantId = UUID_REGEX.test(restaurantId)
      ? restaurantId
      : DEFAULT_RESTAURANT_ID;

    const client = this.supabase.getClient();
    let query = client
      .from('lingtin_feedback_issues')
      .select('*')
      .eq('restaurant_id', safeRestaurantId)
      .order('last_seen_at', { ascending: false });

    if (dateRange?.start) {
      query = query.gte('last_seen_at', dateRange.start);
    }
    if (dateRange?.end) {
      query = query.lte('first_seen_at', `${dateRange.end}T23:59:59`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { issues: data || [] };
  }

  /**
   * 人工分类（支持多角色）
   */
  async classifyIssue(
    id: string,
    role: 'manager' | 'head_chef',
    classification: 'resolved' | 'todo' | 'dismissed',
    note?: string,
    actionBy?: string,
  ) {
    if (this.supabase.isMockMode()) {
      return { success: true };
    }

    const client = this.supabase.getClient();
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = { updated_at: now };

    if (role === 'manager') {
      updateData.manager_classification = classification;
      updateData.manager_action_at = now;
      if (note) updateData.manager_action_note = note;
      if (actionBy) updateData.manager_action_by = actionBy;
    } else {
      updateData.chef_classification = classification;
      updateData.chef_action_at = now;
      if (note) updateData.chef_action_note = note;
      if (actionBy) updateData.chef_action_by = actionBy;
    }

    // Update overall classification:
    // resolved if any role resolved, todo if any todo (and none resolved), dismissed only if all dismissed
    updateData.classification = classification;
    updateData.classified_by = actionBy || role;
    updateData.classified_at = now;

    // Read the other role's classification to compute composite
    const { data: existing } = await client
      .from('lingtin_feedback_issues')
      .select('manager_classification, chef_classification')
      .eq('id', id)
      .single();

    if (existing) {
      const otherCls = role === 'manager' ? existing.chef_classification : existing.manager_classification;
      if (otherCls) {
        // Priority: resolved > todo > dismissed > unclassified
        const priority = { resolved: 3, todo: 2, dismissed: 1 };
        const thisPriority = priority[classification] || 0;
        const otherPriority = priority[otherCls as keyof typeof priority] || 0;
        updateData.classification = thisPriority >= otherPriority ? classification : otherCls;
      }
    }

    const { data, error } = await client
      .from('lingtin_feedback_issues')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, issue: data };
  }

  /**
   * 管理层回复意见
   */
  async replyToIssue(id: string, reply: string, replyBy: string) {
    if (this.supabase.isMockMode()) {
      return { success: true };
    }

    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('lingtin_feedback_issues')
      .update({
        management_reply: reply,
        management_reply_by: replyBy,
        management_reply_at: new Date().toISOString(),
        management_reply_read_by_manager: false,
        management_reply_read_by_chef: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, issue: data };
  }

  /**
   * 门店标记管理层回复已读
   */
  async markReplyRead(id: string, role: 'manager' | 'head_chef') {
    if (this.supabase.isMockMode()) {
      return { success: true };
    }

    const client = this.supabase.getClient();
    const field = role === 'manager'
      ? 'management_reply_read_by_manager'
      : 'management_reply_read_by_chef';

    const { error } = await client
      .from('lingtin_feedback_issues')
      .update({ [field]: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  }

  /**
   * 回填历史数据
   */
  async backfillHistorical(days: number = 30, restaurantId?: string): Promise<{ processed: number; issues: number }> {
    if (this.supabase.isMockMode()) {
      return { processed: 0, issues: 0 };
    }

    const client = this.supabase.getClient();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let query = client
      .from('lingtin_visit_records')
      .select('id, restaurant_id, table_id, audio_url, feedbacks, created_at')
      .gte('created_at', cutoff.toISOString())
      .not('feedbacks', 'is', null)
      .eq('status', 'processed')
      .order('created_at', { ascending: true });

    if (restaurantId && UUID_REGEX.test(restaurantId)) {
      query = query.eq('restaurant_id', restaurantId);
    }

    const { data: records, error } = await query;
    if (error) throw error;

    this.logger.log(`Backfill: found ${records?.length || 0} records for ${days} days`);

    let processed = 0;
    for (const record of records || []) {
      const feedbacks = record.feedbacks as FeedbackItem[];
      if (!feedbacks?.length) continue;

      await this.aggregateSingleVisit({
        id: record.id,
        restaurant_id: record.restaurant_id,
        table_id: record.table_id,
        audio_url: record.audio_url,
        feedbacks,
        created_at: record.created_at,
      });
      processed++;
    }

    // Count resulting issues
    const { count } = await client
      .from('lingtin_feedback_issues')
      .select('id', { count: 'exact', head: true });

    this.logger.log(`Backfill complete: ${processed} records → ${count} issues`);
    return { processed, issues: count || 0 };
  }

  // ─── Private helpers ────────────────────────────────────────

  private inferCategory(fb: FeedbackItem): string {
    if (fb.category) return fb.category;

    const text = fb.text.toLowerCase();
    if (/菜|味|口感|食材|分量|偏[咸淡辣酸甜]|太[咸淡辣酸甜油]/.test(text)) return 'dish_quality';
    if (/上菜|出菜|等|慢|催|速度/.test(text)) return 'service_speed';
    if (/环境|卫生|脏|乱|噪|吵|灯|温度|空调/.test(text)) return 'environment';
    if (/态度|服务|冷淡|热情|礼貌|微笑|脸色/.test(text)) return 'staff_attitude';
    return 'other';
  }

  private findMatchingIssue(
    text: string,
    category: string,
    issues: Array<{ id: string; topic: string; topic_keywords: string[]; category: string; occurrence_count: number; evidence: unknown[]; daily_counts: unknown[] }>,
  ): (typeof issues)[0] | null {
    // 1. Exact topic match
    const exactMatch = issues.find(
      (i) => i.category === category && i.topic === text,
    );
    if (exactMatch) return exactMatch;

    // 2. Keyword contains match
    const keywordMatch = issues.find(
      (i) =>
        i.category === category &&
        (i.topic_keywords || []).some(
          (kw) => text.includes(kw) || kw.includes(text),
        ),
    );
    if (keywordMatch) return keywordMatch;

    // 3. Jaccard similarity on Chinese characters
    const textChars = new Set(text.replace(/[^\u4e00-\u9fff]/g, '').split(''));
    if (textChars.size < 2) return null;

    let bestMatch: (typeof issues)[0] | null = null;
    let bestScore = 0;

    for (const issue of issues) {
      if (issue.category !== category) continue;
      const topicChars = new Set(issue.topic.replace(/[^\u4e00-\u9fff]/g, '').split(''));
      if (topicChars.size < 2) continue;

      const intersection = new Set([...textChars].filter((c) => topicChars.has(c)));
      const union = new Set([...textChars, ...topicChars]);
      const jaccard = intersection.size / union.size;

      if (jaccard > 0.6 && jaccard > bestScore) {
        bestScore = jaccard;
        bestMatch = issue;
      }
    }

    return bestMatch;
  }

  private async updateExistingIssue(
    client: ReturnType<SupabaseService['getClient']>,
    issue: { id: string; topic_keywords: string[]; occurrence_count: number; evidence: unknown[]; daily_counts: unknown[] },
    feedbackText: string,
    evidenceEntry: Record<string, unknown>,
    visitDate: string,
  ) {
    const now = new Date().toISOString();

    // Update topic_keywords
    const keywords = [...(issue.topic_keywords || [])];
    if (!keywords.includes(feedbackText) && keywords.length < MAX_KEYWORDS) {
      keywords.push(feedbackText);
    }

    // Update evidence (keep latest MAX_EVIDENCE)
    const evidence = [...((issue.evidence || []) as Record<string, unknown>[])];
    // Deduplicate by visit_record_id + feedback_text
    const isDuplicate = evidence.some(
      (e) => e.visit_record_id === evidenceEntry.visit_record_id && e.feedback_text === evidenceEntry.feedback_text,
    );
    if (!isDuplicate) {
      evidence.push(evidenceEntry);
      if (evidence.length > MAX_EVIDENCE) {
        evidence.shift(); // Remove oldest
      }
    }

    // Update daily_counts
    const dailyCounts = [...((issue.daily_counts || []) as Array<{ date: string; count: number }>)];
    const dayEntry = dailyCounts.find((d) => d.date === visitDate);
    if (dayEntry) {
      dayEntry.count++;
    } else {
      dailyCounts.push({ date: visitDate, count: 1 });
    }

    const { error } = await client
      .from('lingtin_feedback_issues')
      .update({
        topic_keywords: keywords,
        occurrence_count: (issue.occurrence_count || 0) + 1,
        last_seen_at: now,
        evidence,
        daily_counts: dailyCounts,
        updated_at: now,
      })
      .eq('id', issue.id);

    if (error) {
      this.logger.warn(`Failed to update issue ${issue.id}: ${error.message}`);
    }
  }

  private async createNewIssue(
    client: ReturnType<SupabaseService['getClient']>,
    restaurantId: string,
    category: string,
    feedbackText: string,
    evidenceEntry: Record<string, unknown>,
    visitDate: string,
  ) {
    const now = new Date().toISOString();

    const { data, error } = await client
      .from('lingtin_feedback_issues')
      .upsert(
        {
          restaurant_id: restaurantId,
          category,
          topic: feedbackText,
          topic_keywords: [],
          first_seen_at: now,
          last_seen_at: now,
          occurrence_count: 1,
          evidence: [evidenceEntry],
          daily_counts: [{ date: visitDate, count: 1 }],
          classification: 'unclassified',
          created_at: now,
          updated_at: now,
        },
        { onConflict: 'restaurant_id,category,topic' },
      )
      .select()
      .single();

    if (error) {
      this.logger.warn(`Failed to create issue: ${error.message}`);
      return null;
    }
    return data;
  }

  /**
   * Check if a topic is kitchen-relevant (for chef filtering)
   */
  isKitchenRelevant(issue: { category: string; topic: string }): boolean {
    if (KITCHEN_CATEGORIES.includes(issue.category)) return true;
    return KITCHEN_KEYWORDS.some((kw) => issue.topic.includes(kw));
  }
}
