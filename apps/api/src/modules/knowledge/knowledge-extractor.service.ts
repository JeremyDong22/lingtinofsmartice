// Knowledge Extractor Service — extracts business knowledge from all signal sources
// v1.0 — visit records, meeting records, action item resolutions

import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeService, KnowledgeCreateInput } from './knowledge.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { sendBarkNotification } from './bark-notify';
import type { FeedbackItem } from '../audio/ai-processing.service';

// ─── Input types ────────────────────────────────────────────────────

export interface VisitExtractionInput {
  feedbacks: FeedbackItem[];
  customerSource: string | null;
  visitFrequency: string | null;
  managerQuestions: string[];
  customerAnswers: string[];
  aiSummary: string;
  tableId?: string;
  createdAt?: string;
  duration?: number | null;
  visitPeriod?: string | null;
}

export interface MeetingExtractionInput {
  aiSummary: string;
  actionItems: Array<{ who: string; what: string; deadline: string }>;
  keyDecisions: Array<{ decision: string; context: string }>;
  meetingType: string;
}

export interface ActionResolutionInput {
  suggestion: string;
  category: string;
  resolvedNote: string;
}

@Injectable()
export class KnowledgeExtractorService {
  private readonly logger = new Logger(KnowledgeExtractorService.name);

  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly supabase: SupabaseService,
  ) {}

  // ─── Visit Extraction (rule-based, no AI calls) ──────────────────

  async extractFromVisit(
    recordingId: string,
    restaurantId: string,
    input: VisitExtractionInput,
  ): Promise<number> {
    let created = 0;
    const { feedbacks, customerSource, visitFrequency } = input;

    if (!feedbacks?.length) return 0;

    // Load dish dictionary for matching
    const dishNames = await this.loadDishNames(restaurantId);

    for (const fb of feedbacks) {
      if (!fb.text) continue;

      // Rule 1: Feedback mentioning a specific dish → L1 example/dish
      const matchedDish = this.matchDish(fb.text, dishNames);
      if (matchedDish) {
        const { error } = await this.knowledgeService.createKnowledge({
          restaurant_id: restaurantId,
          scope: 'restaurant',
          knowledge_type: 'example',
          category: 'dish',
          depth_level: 'L1',
          title: `${matchedDish}: ${fb.text}`,
          content: {
            dish_name: matchedDish,
            feedback_text: fb.text,
            sentiment: fb.sentiment,
            score: fb.score,
            customer_source: customerSource,
            visit_frequency: visitFrequency,
          },
          quality_score: 0.6,
          confidence: 0.8,
          source_type: 'auto',
          source_signal: 'visit_extraction',
          source_record_id: recordingId,
          source_record_type: 'visit_record',
          auto_approve: true,
        });
        if (!error) created++;
      }

      // Rule 2: Negative feedback score < 30 → L1 example (auto-approve)
      if (fb.score < 30) {
        const category = matchedDish ? 'dish' : 'service';
        const { error } = await this.knowledgeService.createKnowledge({
          restaurant_id: restaurantId,
          scope: 'restaurant',
          knowledge_type: 'example',
          category,
          depth_level: 'L1',
          title: `负面反馈: ${fb.text}`,
          content: {
            feedback_text: fb.text,
            sentiment: fb.sentiment,
            score: fb.score,
            dish_name: matchedDish || null,
            customer_source: customerSource,
            visit_frequency: visitFrequency,
            ai_summary: input.aiSummary,
          },
          quality_score: 0.65,
          confidence: 0.85,
          source_type: 'auto',
          source_signal: 'visit_negative_extraction',
          source_record_id: recordingId,
          source_record_type: 'visit_record',
          auto_approve: true,
        });
        if (!error) created++;
      }
    }

    // Rule 3: Customer source tracking → update benchmark counter
    if (customerSource) {
      await this.updateCustomerSourceBenchmark(restaurantId, customerSource);
    }

    // Write visit metadata to ai_metrics for behavior analysis (Step 5)
    await this.writeVisitMetadata(recordingId, restaurantId, input);

    if (created > 0) {
      this.logger.log(`Visit ${recordingId}: extracted ${created} knowledge entries`);
    }

    return created;
  }

  // ─── Meeting Extraction ──────────────────────────────────────────

  async extractFromMeeting(
    meetingId: string,
    restaurantId: string,
    input: MeetingExtractionInput,
  ): Promise<number> {
    let created = 0;
    const { keyDecisions, meetingType } = input;

    if (!keyDecisions?.length) return 0;

    // Determine scope: cross_store meetings → brand level
    const isCrossStore = meetingType === 'cross_store_review';
    const scope: 'restaurant' | 'brand' = isCrossStore ? 'brand' : 'restaurant';
    let brandId: number | null = null;

    if (isCrossStore) {
      const client = this.supabase.getClient();
      const { data } = await client
        .from('master_restaurant')
        .select('brand_id')
        .eq('id', restaurantId)
        .single();
      brandId = data?.brand_id ?? null;
    }

    for (const kd of keyDecisions) {
      if (!kd.decision) continue;

      const knowledgeInput: KnowledgeCreateInput = {
        restaurant_id: isCrossStore ? null : restaurantId,
        brand_id: brandId,
        scope,
        knowledge_type: 'best_practice',
        category: 'operation',
        depth_level: 'L1',
        title: `会议决策: ${kd.decision.substring(0, 100)}`,
        content: {
          decision: kd.decision,
          context: kd.context,
          meeting_type: meetingType,
          meeting_id: meetingId,
        },
        quality_score: 0.6,
        confidence: 0.7,
        source_type: 'auto',
        source_signal: 'meeting_extraction',
        source_record_id: meetingId,
        source_record_type: 'meeting_record',
        auto_approve: false, // Decisions need human review
      };

      const { error } = await this.knowledgeService.createKnowledge(knowledgeInput);
      if (!error) created++;
    }

    if (created > 0) {
      this.logger.log(`Meeting ${meetingId}: extracted ${created} knowledge entries`);
      await sendBarkNotification(
        '📋 复盘会知识提取',
        `发现 ${created} 条关键决策，请审核`,
      );
    }

    return created;
  }

  // ─── Action Item Resolution → Experience ─────────────────────────

  async extractFromActionResolution(
    actionItemId: string,
    restaurantId: string,
    input: ActionResolutionInput,
  ): Promise<boolean> {
    if (!input.resolvedNote) return false;

    const { error } = await this.knowledgeService.createKnowledge({
      restaurant_id: restaurantId,
      scope: 'restaurant',
      knowledge_type: 'example',
      category: 'operation',
      depth_level: 'L1',
      title: `经验: ${input.suggestion.substring(0, 80)}`,
      content: {
        original_suggestion: input.suggestion,
        category: input.category,
        resolved_note: input.resolvedNote,
        action_item_id: actionItemId,
        source_type_tag: 'experience',
      },
      quality_score: 0.65,
      confidence: 0.75,
      source_type: 'auto',
      source_signal: 'action_resolution',
      source_record_id: actionItemId,
      source_record_type: 'action_item',
      auto_approve: false, // Experience needs review
    });

    if (!error) {
      this.logger.log(`Action item ${actionItemId}: experience knowledge created`);
      await sendBarkNotification(
        '✅ 行动项经验沉淀',
        `"${input.suggestion.substring(0, 40)}..." 已解决并沉淀经验，请审核`,
      );
      return true;
    }

    return false;
  }

  // ─── Private helpers ─────────────────────────────────────────────

  private async loadDishNames(restaurantId: string): Promise<string[]> {
    try {
      const client = this.supabase.getClient();
      const { data } = await client
        .from('lingtin_dishname_view')
        .select('dish_name')
        .eq('restaurant_id', restaurantId);
      return (data || []).map(d => d.dish_name).filter(Boolean);
    } catch {
      return [];
    }
  }

  private matchDish(text: string, dishNames: string[]): string | null {
    if (!dishNames.length) return null;
    const normalized = text.toLowerCase();
    for (const name of dishNames) {
      if (normalized.includes(name.toLowerCase())) {
        return name;
      }
    }
    return null;
  }

  private async updateCustomerSourceBenchmark(
    restaurantId: string,
    source: string,
  ): Promise<void> {
    try {
      await this.knowledgeService.recordMetric({
        metric_date: new Date().toISOString().split('T')[0],
        restaurant_id: restaurantId,
        metric_type: 'customer_source',
        metric_value: { source, count: 1 },
      });
    } catch (e) {
      this.logger.warn(`Failed to record customer source metric: ${e}`);
    }
  }

  private async writeVisitMetadata(
    recordingId: string,
    restaurantId: string,
    input: VisitExtractionInput,
  ): Promise<void> {
    try {
      // Use passed metadata if available, otherwise fall back to DB read
      let tableId = input.tableId;
      let createdAt = input.createdAt;
      let duration = input.duration;
      let visitPeriod = input.visitPeriod;

      if (!tableId) {
        const client = this.supabase.getClient();
        const { data } = await client
          .from('lingtin_visit_records')
          .select('table_id, created_at, duration, visit_period')
          .eq('id', recordingId)
          .single();
        if (!data) return;
        tableId = data.table_id;
        createdAt = data.created_at;
        duration = data.duration;
        visitPeriod = data.visit_period;
      }

      await this.knowledgeService.recordMetric({
        metric_date: new Date().toISOString().split('T')[0],
        restaurant_id: restaurantId,
        metric_type: 'visit_metadata',
        metric_value: {
          recording_id: recordingId,
          table_id: tableId,
          timestamp: createdAt,
          duration,
          visit_period: visitPeriod,
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to write visit metadata: ${e}`);
    }
  }

}
