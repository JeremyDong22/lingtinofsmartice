// Action Items Service - AI-generated improvement suggestions
// v2.0 - Removed daily_aggregation generation path; action items now come from meeting processing only

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';

const DEFAULT_RESTAURANT_ID = '0b9e9031-4223-4124-b633-e3a853abfb8f';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ActionItemsService {
  private readonly logger = new Logger(ActionItemsService.name);

  constructor(private readonly supabase: SupabaseService) {}

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
      .order('priority', { ascending: true }) // high first (alphabetical: h < l < m)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Re-sort by priority weight: high > medium > low
    const priorityWeight: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sorted = (data || []).sort(
      (a, b) => (priorityWeight[a.priority] ?? 3) - (priorityWeight[b.priority] ?? 3),
    );

    return { actions: sorted };
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

    // Sort by priority weight (high first), then by date (newest first)
    const priorityWeight: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sorted = (data || []).sort((a, b) => {
      const pw = (priorityWeight[a.priority] ?? 3) - (priorityWeight[b.priority] ?? 3);
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

  // Update action item status
  async updateActionItem(id: string, status: string, note?: string, responseNote?: string) {
    if (this.supabase.isMockMode()) {
      return { action: { id, status, updated_at: new Date().toISOString() } };
    }
    const client = this.supabase.getClient();

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'acknowledged') {
      updateData.acknowledged_at = new Date().toISOString();
    } else if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
      if (note) updateData.resolved_note = note;
      if (responseNote) updateData.response_note = responseNote;
    } else if (status === 'dismissed') {
      updateData.dismissed_at = new Date().toISOString();
      if (note) updateData.dismiss_reason = note;
      if (responseNote) updateData.response_note = responseNote;
    }

    const { data, error } = await client
      .from('lingtin_action_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return { action: data };
  }
}
