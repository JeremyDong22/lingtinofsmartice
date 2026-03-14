// Action Items Service - AI-generated improvement suggestions
// v3.1 - Added batch-create, fixed priorityWeight duplication, use getChinaDateString

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { KnowledgeExtractorService } from '../knowledge/knowledge-extractor.service';
import { getChinaDateString } from '../../common/utils/date';

const DEFAULT_RESTAURANT_ID = '0b9e9031-4223-4124-b633-e3a853abfb8f';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIORITY_WEIGHT: Record<string, number> = { high: 0, medium: 1, low: 2 };

function sortByPriority<T extends { priority: string }>(items: T[]): T[] {
  return items.sort(
    (a, b) => (PRIORITY_WEIGHT[a.priority] ?? 3) - (PRIORITY_WEIGHT[b.priority] ?? 3),
  );
}

@Injectable()
export class ActionItemsService {
  private readonly logger = new Logger(ActionItemsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly knowledgeExtractor: KnowledgeExtractorService,
  ) {}

  // Get action items for a restaurant on a given date
  async getActionItems(restaurantId: string, date: string) {
    if (this.supabase.isMockMode()) {
      return {
        actions: [
          {
            id: 'mock-action-1', restaurant_id: restaurantId, action_date: date,
            category: 'dish_quality', priority: 'high', status: 'pending',
            suggestion_text: '3桌顾客反映清蒸鲈鱼偏咸，建议与厨师长沟通减少盐量',
            evidence: [{ visitId: 'mock-v1', tableId: 'A3', feedback: '偏咸', sentiment: 'negative' }],
          },
          {
            id: 'mock-action-2', restaurant_id: restaurantId, action_date: date,
            category: 'service_speed', priority: 'medium', status: 'pending',
            suggestion_text: 'A5桌顾客反映上菜速度慢，建议优化午市高峰期出菜流程',
            evidence: [{ visitId: 'mock-v2', tableId: 'A5', feedback: '上菜慢', sentiment: 'negative' }],
          },
          {
            id: 'mock-action-3', restaurant_id: restaurantId, action_date: date,
            category: 'environment', priority: 'low', status: 'pending',
            suggestion_text: 'B2桌顾客提到空调温度偏高，建议调低1-2度',
            evidence: [{ visitId: 'mock-v3', tableId: 'B2', feedback: '太热了', sentiment: 'negative' }],
          },
        ],
      };
    }
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('lingtin_action_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('action_date', date)
      .neq('status', 'dismissed')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { actions: sortByPriority(data || []) };
  }

  // Get all pending/acknowledged action items across all dates (for kitchen meeting reminders)
  async getPendingActionItems(restaurantId: string, limit = 20, includeAudio = false) {
    const safeRestaurantId = UUID_REGEX.test(restaurantId) ? restaurantId : DEFAULT_RESTAURANT_ID;

    if (this.supabase.isMockMode()) {
      return {
        actions: [
          {
            id: 'mock-pending-1', restaurant_id: safeRestaurantId, action_date: '2026-02-24',
            category: 'dish_quality', priority: 'high', status: 'pending',
            suggestion_text: '清蒸鲈鱼偏咸，建议减盐',
            evidence: [{ visitId: 'mock-v1', tableId: 'A3', feedback: '偏咸', sentiment: 'negative', audioUrl: null }],
          },
          {
            id: 'mock-pending-2', restaurant_id: safeRestaurantId, action_date: '2026-02-24',
            category: 'dish_quality', priority: 'medium', status: 'pending',
            suggestion_text: '午市出菜速度慢，优化流程',
            evidence: [{ visitId: 'mock-v2', tableId: 'A5', feedback: '上菜慢', sentiment: 'negative', audioUrl: null }],
          },
          {
            id: 'mock-pending-3', restaurant_id: safeRestaurantId, action_date: '2026-02-22',
            category: 'dish_quality', priority: 'medium', status: 'acknowledged',
            suggestion_text: '重新评估调整油焖虾口味',
            evidence: [{ visitId: 'mock-v3', tableId: 'B2', feedback: '口味不对', sentiment: 'negative', audioUrl: null }],
          },
        ],
      };
    }

    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('lingtin_action_items')
      .select('*')
      .eq('restaurant_id', safeRestaurantId)
      .in('status', ['pending', 'acknowledged'])
      .order('action_date', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Sort by priority (high first), then by date (newest first)
    const sorted = sortByPriority(data || []).sort((a, b) => {
      const pw = (PRIORITY_WEIGHT[a.priority] ?? 3) - (PRIORITY_WEIGHT[b.priority] ?? 3);
      if (pw !== 0) return pw;
      return (b.action_date || '').localeCompare(a.action_date || '');
    });

    // Enrich evidence with audio URLs from visit_records
    if (includeAudio && sorted.length > 0) {
      const visitIds = new Set<string>();
      for (const action of sorted) {
        const evidence = action.evidence as Array<{ visitId?: string }> | null;
        if (Array.isArray(evidence)) {
          for (const ev of evidence) {
            if (ev.visitId) visitIds.add(ev.visitId);
          }
        }
      }
      if (visitIds.size > 0) {
        const { data: visitData } = await client
          .from('lingtin_visit_records')
          .select('id, audio_url')
          .in('id', [...visitIds]);
        const audioMap = new Map<string, string | null>();
        for (const v of (visitData || [])) {
          audioMap.set(v.id, v.audio_url);
        }
        for (const action of sorted) {
          const evidence = action.evidence as Array<{ visitId?: string; audioUrl?: string | null }> | null;
          if (Array.isArray(evidence)) {
            for (const ev of evidence) {
              if (ev.visitId && audioMap.has(ev.visitId)) {
                ev.audioUrl = audioMap.get(ev.visitId) ?? null;
              }
            }
          }
        }
      }
    }

    return { actions: sorted };
  }

  // Create a single action item
  async createActionItem(params: {
    restaurant_id: string;
    suggestion_text: string;
    assigned_role?: string;
    deadline?: string;
    category?: string;
    priority?: string;
    source_meeting_id?: string;
  }) {
    const safeRestaurantId = UUID_REGEX.test(params.restaurant_id) ? params.restaurant_id : DEFAULT_RESTAURANT_ID;

    if (this.supabase.isMockMode()) {
      return { action: { id: 'mock-new-' + Date.now(), ...params, status: 'pending', created_at: new Date().toISOString() } };
    }
    const client = this.supabase.getClient();
    const now = new Date().toISOString();

    const { data, error } = await client
      .from('lingtin_action_items')
      .insert({
        restaurant_id: safeRestaurantId,
        suggestion_text: params.suggestion_text,
        assigned_role: params.assigned_role || null,
        deadline: params.deadline || null,
        category: params.category || 'other',
        priority: params.priority || 'medium',
        status: 'pending',
        action_date: getChinaDateString(),
        source_meeting_id: params.source_meeting_id || null,
        confirmed_at: now,
      })
      .select()
      .single();

    if (error) throw error;
    return { action: data };
  }

  // Batch create action items (guided review — single round-trip)
  async batchCreateActionItems(params: {
    restaurant_id: string;
    items: Array<{
      suggestion_text: string;
      assigned_role?: string;
      deadline?: string;
      category?: string;
      priority?: string;
    }>;
    source_meeting_id?: string;
  }) {
    if (!params.items || params.items.length === 0) return { actions: [], count: 0 };

    const safeRestaurantId = UUID_REGEX.test(params.restaurant_id) ? params.restaurant_id : DEFAULT_RESTAURANT_ID;

    if (this.supabase.isMockMode()) {
      return {
        actions: params.items.map((item, i) => ({
          id: `mock-batch-${Date.now()}-${i}`, ...item, status: 'pending',
        })),
        count: params.items.length,
      };
    }

    const client = this.supabase.getClient();
    const now = new Date().toISOString();
    const actionDate = getChinaDateString();

    const rows = params.items.map(item => ({
      restaurant_id: safeRestaurantId,
      suggestion_text: item.suggestion_text,
      assigned_role: item.assigned_role || null,
      deadline: item.deadline || null,
      category: item.category || 'meeting_review',
      priority: item.priority || 'medium',
      status: 'pending',
      action_date: actionDate,
      source_meeting_id: params.source_meeting_id || null,
      confirmed_at: now,
    }));

    const { data, error } = await client
      .from('lingtin_action_items')
      .insert(rows)
      .select();

    if (error) throw error;
    return { actions: data || [], count: (data || []).length };
  }

  // Update action item — status change and/or content edit
  async updateActionItem(id: string, body: {
    status?: string;
    suggestion_text?: string;
    assigned_role?: string;
    deadline?: string;
    note?: string;
    response_note?: string;
  }) {
    const { status, suggestion_text, assigned_role, deadline, note, response_note: responseNote } = body;

    if (this.supabase.isMockMode()) {
      return { action: { id, ...body, updated_at: new Date().toISOString() } };
    }
    const client = this.supabase.getClient();
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = { updated_at: now };

    // Content edits
    if (suggestion_text !== undefined) updateData.suggestion_text = suggestion_text;
    if (assigned_role !== undefined) updateData.assigned_role = assigned_role;
    if (deadline !== undefined) updateData.deadline = deadline;

    // Status transitions
    if (status) {
      updateData.status = status;
      if (status === 'acknowledged') {
        updateData.acknowledged_at = now;
      } else if (status === 'resolved') {
        updateData.resolved_at = now;
        if (note) updateData.resolved_note = note;
        if (responseNote) updateData.response_note = responseNote;
      } else if (status === 'dismissed') {
        updateData.dismissed_at = now;
        if (note) updateData.dismiss_reason = note;
        if (responseNote) updateData.response_note = responseNote;
      }
    }

    const { data, error } = await client
      .from('lingtin_action_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Extract experience knowledge when resolved with a note
    if (status === 'resolved' && note && data) {
      this.knowledgeExtractor.extractFromActionResolution(
        id,
        data.restaurant_id,
        {
          suggestion: data.suggestion_text || '',
          category: data.category || 'other',
          resolvedNote: note,
        },
      ).catch(e => this.logger.warn('Action resolution extraction failed (non-fatal)', e));
    }

    return { action: data };
  }

  // Delete an action item
  async deleteActionItem(id: string) {
    if (this.supabase.isMockMode()) {
      return { deleted: true };
    }
    const client = this.supabase.getClient();

    const { error } = await client
      .from('lingtin_action_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { deleted: true };
  }

  // Batch confirm action items (mark confirmed_at)
  async batchConfirmActionItems(ids: string[]) {
    if (!ids || ids.length === 0) return { confirmed: 0 };

    if (this.supabase.isMockMode()) {
      return { confirmed: ids.length };
    }
    const client = this.supabase.getClient();
    const now = new Date().toISOString();

    const { error, count } = await client
      .from('lingtin_action_items')
      .update({ confirmed_at: now, updated_at: now })
      .in('id', ids);

    if (error) throw error;
    return { confirmed: count ?? ids.length };
  }
}
