// Hotword Service - CRUD operations for lingtin_hotwords + sync to DashScope
// v1.0

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { DashScopeVocabularyService, VocabularyWord } from './dashscope-vocabulary.service';

export interface Hotword {
  id: string;
  text: string;
  weight: number;
  category: string;
  source: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface HotwordStats {
  total: number;
  enabled: number;
  lastSync: {
    synced_at: string;
    word_count: number;
    status: string;
    error_message: string | null;
  } | null;
}

@Injectable()
export class HotwordService {
  private readonly logger = new Logger(HotwordService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly vocabularyService: DashScopeVocabularyService,
  ) {}

  /**
   * List hotwords with optional search and category filter
   */
  async list(params: { search?: string; category?: string; source?: string }): Promise<{ data: Hotword[] }> {
    if (this.supabase.isMockMode()) {
      return { data: this.getMockHotwords() };
    }

    const client = this.supabase.getClient();
    let query = client
      .from('lingtin_hotwords')
      .select('*')
      .order('updated_at', { ascending: false });

    if (params.search) {
      query = query.ilike('text', `%${params.search}%`);
    }
    if (params.category) {
      query = query.eq('category', params.category);
    }
    if (params.source) {
      query = query.eq('source', params.source);
    }

    const { data, error } = await query;
    if (error) throw error;

    return { data: data || [] };
  }

  /**
   * Get stats: total count, enabled count, last sync info
   */
  async getStats(): Promise<{ data: HotwordStats }> {
    if (this.supabase.isMockMode()) {
      return {
        data: {
          total: 162,
          enabled: 152,
          lastSync: { synced_at: new Date().toISOString(), word_count: 152, status: 'success', error_message: null },
        },
      };
    }

    const client = this.supabase.getClient();

    // Count total and enabled in parallel
    const [totalResult, enabledResult, syncResult] = await Promise.all([
      client.from('lingtin_hotwords').select('id', { count: 'exact', head: true }),
      client.from('lingtin_hotwords').select('id', { count: 'exact', head: true }).eq('is_enabled', true),
      client.from('lingtin_hotword_sync_log').select('*').order('synced_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    return {
      data: {
        total: totalResult.count || 0,
        enabled: enabledResult.count || 0,
        lastSync: syncResult.data || null,
      },
    };
  }

  /**
   * Add a single hotword
   */
  async create(body: { text: string; weight?: number; category?: string; source?: string }): Promise<{ data: Hotword }> {
    if (this.supabase.isMockMode()) {
      return { data: { id: 'mock-hw-new', text: body.text, weight: body.weight || 3, category: body.category || 'other', source: body.source || 'manual', is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } };
    }

    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('lingtin_hotwords')
      .insert({
        text: body.text.trim(),
        weight: body.weight ?? 3,
        category: body.category || 'other',
        source: body.source || 'manual',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`DUPLICATE: 热词「${body.text}」已存在`);
      }
      throw error;
    }

    this.logger.log(`Created hotword: ${body.text}`);
    return { data };
  }

  /**
   * Update a hotword
   */
  async update(id: string, body: { weight?: number; category?: string; is_enabled?: boolean }): Promise<{ data: Hotword }> {
    if (this.supabase.isMockMode()) {
      return { data: { id, text: 'mock', weight: body.weight || 3, category: body.category || 'other', source: 'manual', is_enabled: body.is_enabled ?? true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } };
    }

    const client = this.supabase.getClient();
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.weight !== undefined) updateData.weight = body.weight;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.is_enabled !== undefined) updateData.is_enabled = body.is_enabled;

    const { data, error } = await client
      .from('lingtin_hotwords')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { data };
  }

  /**
   * Delete a single hotword
   */
  async delete(id: string): Promise<{ message: string }> {
    if (this.supabase.isMockMode()) {
      return { message: '已删除' };
    }

    const client = this.supabase.getClient();
    const { error } = await client.from('lingtin_hotwords').delete().eq('id', id);
    if (error) throw error;
    return { message: '已删除' };
  }

  /**
   * Batch add hotwords (skip duplicates)
   */
  async batchCreate(items: Array<{ text: string; weight?: number; category?: string; source?: string }>): Promise<{ data: { added: number; skipped: number } }> {
    if (this.supabase.isMockMode()) {
      return { data: { added: items.length, skipped: 0 } };
    }

    const client = this.supabase.getClient();
    const rows = items.map((item) => ({
      text: item.text.trim(),
      weight: item.weight ?? 3,
      category: item.category || 'other',
      source: item.source || 'manual',
    }));

    // Use upsert with onConflict to skip duplicates
    const { data, error } = await client
      .from('lingtin_hotwords')
      .upsert(rows, { onConflict: 'text', ignoreDuplicates: true })
      .select();

    if (error) throw error;

    const added = data?.length || 0;
    return { data: { added, skipped: items.length - added } };
  }

  /**
   * Batch delete hotwords by IDs
   */
  async batchDelete(ids: string[]): Promise<{ message: string; deleted: number }> {
    if (this.supabase.isMockMode()) {
      return { message: '已删除', deleted: ids.length };
    }

    const client = this.supabase.getClient();
    const { error, count } = await client
      .from('lingtin_hotwords')
      .delete({ count: 'exact' })
      .in('id', ids);

    if (error) throw error;
    return { message: '已删除', deleted: count || 0 };
  }

  /**
   * Get menu diff: compare lingtin_dishname_view with current hotwords
   * Returns new dishes (not in hotwords), existing (already hotwords), and removed (hotword but not on menu)
   */
  async getMenuDiff(): Promise<{
    data: {
      newDishes: string[];
      existing: string[];
      removed: string[];
    };
  }> {
    if (this.supabase.isMockMode()) {
      return { data: { newDishes: ['新菜A', '新菜B'], existing: ['酸菜鱼', '红烧肉'], removed: ['已下架菜'] } };
    }

    const client = this.supabase.getClient();

    // Fetch menu dishes and current hotwords in parallel
    const [dishResult, hotwordResult] = await Promise.all([
      client.from('lingtin_dishname_view').select('dish_name'),
      client.from('lingtin_hotwords').select('text').eq('category', 'dish_name'),
    ]);

    const menuDishes = new Set((dishResult.data || []).map((d) => d.dish_name));
    const hotwordTexts = new Set((hotwordResult.data || []).map((h) => h.text));

    const newDishes = [...menuDishes].filter((d) => !hotwordTexts.has(d));
    const existing = [...menuDishes].filter((d) => hotwordTexts.has(d));
    const removed = [...hotwordTexts].filter((t) => !menuDishes.has(t));

    return { data: { newDishes, existing, removed } };
  }

  /**
   * Import selected dishes from menu as hotwords
   */
  async menuImport(dishes: string[]): Promise<{ data: { added: number; skipped: number } }> {
    return this.batchCreate(
      dishes.map((name) => ({
        text: name,
        weight: 3,
        category: 'dish_name',
        source: 'menu_import',
      })),
    );
  }

  /**
   * Sync all enabled hotwords to DashScope vocabulary
   */
  async syncToDashScope(): Promise<{
    data: { vocabularyId: string; wordCount: number; status: string };
  }> {
    if (this.supabase.isMockMode()) {
      return { data: { vocabularyId: 'mock-vocab-id', wordCount: 152, status: 'success' } };
    }

    const client = this.supabase.getClient();

    // Get all enabled hotwords
    const { data: hotwords, error } = await client
      .from('lingtin_hotwords')
      .select('text, weight')
      .eq('is_enabled', true);

    if (error) throw error;

    const words: VocabularyWord[] = (hotwords || []).map((h) => ({
      text: h.text,
      weight: h.weight,
    }));

    this.logger.log(`Syncing ${words.length} hotwords to DashScope...`);

    try {
      const result = await this.vocabularyService.updateVocabulary(words);

      // Log success
      await client.from('lingtin_hotword_sync_log').insert({
        word_count: result.wordCount,
        vocabulary_id: result.vocabularyId,
        status: 'success',
      });

      return { data: { vocabularyId: result.vocabularyId, wordCount: result.wordCount, status: 'success' } };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Log failure
      await client.from('lingtin_hotword_sync_log').insert({
        word_count: words.length,
        vocabulary_id: process.env.DASHSCOPE_VOCABULARY_ID || '',
        status: 'failed',
        error_message: errorMessage,
      });

      throw err;
    }
  }

  /**
   * Seed hotwords from DashScope: query current vocabulary and insert into DB
   */
  async seedFromDashScope(): Promise<{ data: { imported: number } }> {
    if (this.supabase.isMockMode()) {
      return { data: { imported: 0 } };
    }

    const words = await this.vocabularyService.queryVocabulary();
    if (words.length === 0) {
      return { data: { imported: 0 } };
    }

    const client = this.supabase.getClient();
    const rows = words.map((w) => ({
      text: w.text,
      weight: w.weight,
      category: 'other' as const,
      source: 'manual' as const,
    }));

    const { data, error } = await client
      .from('lingtin_hotwords')
      .upsert(rows, { onConflict: 'text', ignoreDuplicates: true })
      .select();

    if (error) throw error;

    const imported = data?.length || 0;
    this.logger.log(`Seeded ${imported} hotwords from DashScope vocabulary`);
    return { data: { imported } };
  }

  private getMockHotwords(): Hotword[] {
    return [
      { id: 'mock-1', text: '酸菜鱼', weight: 3, category: 'dish_name', source: 'manual', is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'mock-2', text: '巴奴', weight: 5, category: 'brand', source: 'manual', is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'mock-3', text: '毛肚', weight: 4, category: 'dish_name', source: 'menu_import', is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
  }
}
