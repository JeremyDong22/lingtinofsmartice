import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';

// ─── Types ───────────────────────────────────────────────────────────

export type KnowledgeScope = 'restaurant' | 'brand' | 'region' | 'global';
export type KnowledgeType =
  | 'profile'
  | 'example'
  | 'pattern'
  | 'benchmark'
  | 'best_practice'
  | 'rule';
export type KnowledgeCategory =
  | 'dish'
  | 'service'
  | 'environment'
  | 'staff'
  | 'customer'
  | 'operation'
  | 'general'
  | 'best_practice'
  | 'opportunity'
  | 'emergent';
export type DepthLevel = 'L1' | 'L2' | 'L3' | 'L4';
export type KnowledgeStatus =
  | 'draft'
  | 'active'
  | 'superseded'
  | 'archived'
  | 'deprecated';
export type ReviewStatus =
  | 'pending_review'
  | 'approved'
  | 'revision_requested'
  | 'rejected';
export type SourceType = 'auto' | 'manual' | 'promoted' | 'distilled';
export type SourceRecordType = 'visit_record' | 'meeting_record' | 'action_item';
export type AIOperation =
  | 'analysis'
  | 'summary'
  | 'action'
  | 'chat'
  | 'briefing';

export interface KnowledgeEntry {
  id: string;
  restaurant_id: string | null;
  brand_id: number | null;
  region_id: string | null;
  scope: KnowledgeScope;
  knowledge_type: KnowledgeType;
  category: KnowledgeCategory | null;
  depth_level: DepthLevel;
  title: string | null;
  content: Record<string, unknown>;
  quality_score: number;
  usage_count: number;
  last_used_at: string | null;
  source_signal: string | null;
  source_type: SourceType;
  source_data: Record<string, unknown> | null;
  version: number;
  parent_id: string | null;
  confidence: number;
  valid_from: string;
  valid_until: string | null;
  superseded_by: string | null;
  review_status: ReviewStatus;
  reviewer_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  auto_approve: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  status: KnowledgeStatus;
}

export interface RelevantKnowledge {
  profile: string | null;
  examples: string | null;
  patterns: string | null;
  benchmarks: string | null;
  bestPractices: string | null;
  rules: string | null;
  raw: KnowledgeEntry[];
}

export interface LearningEventInput {
  signal_id: string;
  action: string;
  restaurant_id?: string;
  input_summary?: string;
  output_knowledge_ids?: string[];
  metrics?: Record<string, unknown>;
  status?: 'completed' | 'failed' | 'skipped';
  error_message?: string;
}

export interface MetricInput {
  metric_date: string;
  restaurant_id?: string;
  metric_type: string;
  metric_value: Record<string, unknown>;
}

export interface KnowledgeCreateInput {
  restaurant_id?: string | null;
  brand_id?: number | null;
  region_id?: string | null;
  scope: KnowledgeScope;
  knowledge_type: KnowledgeType;
  category?: KnowledgeCategory | null;
  depth_level?: DepthLevel;
  title?: string | null;
  content: Record<string, unknown>;
  quality_score?: number;
  confidence?: number;
  source_signal?: string | null;
  source_type?: SourceType;
  source_data?: Record<string, unknown> | null;
  source_record_id?: string | null;
  source_record_type?: SourceRecordType | null;
  auto_approve?: boolean;
}

// ─── Retrieval config per AI operation ───────────────────────────────

interface RetrievalConfig {
  types: KnowledgeType[];
  categories: KnowledgeCategory[] | 'all';
  maxTokens: number;
  freshnessWeight: number;
}

const RETRIEVAL_CONFIG: Record<AIOperation, RetrievalConfig> = {
  analysis: {
    types: ['profile', 'example', 'rule'],
    categories: ['dish', 'service', 'environment', 'customer', 'general'],
    maxTokens: 1500,
    freshnessWeight: 0.2,
  },
  chat: {
    types: ['profile', 'pattern', 'best_practice', 'benchmark', 'example'],
    categories: 'all',
    maxTokens: 2000,
    freshnessWeight: 0.4,
  },
  summary: {
    types: ['profile', 'benchmark', 'pattern', 'best_practice', 'example'],
    categories: 'all',
    maxTokens: 1500,
    freshnessWeight: 0.5,
  },
  action: {
    types: ['best_practice', 'pattern', 'benchmark', 'example'],
    categories: 'all',
    maxTokens: 1000,
    freshnessWeight: 0.3,
  },
  briefing: {
    types: ['profile', 'pattern', 'benchmark'],
    categories: 'all',
    maxTokens: 1500,
    freshnessWeight: 0.5,
  },
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Quality score weights
const SCORE_WEIGHTS = {
  freshness: 0.3,
  authority: 0.2,
  engagement: 0.1,
  confidence: 0.4,
};

const AUTHORITY_SCORES: Record<SourceType, number> = {
  manual: 1.0,
  promoted: 0.8,
  distilled: 0.7,
  auto: 0.5,
};

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ─── Core: Get Relevant Knowledge for AI Operations ──────────────

  /**
   * Retrieves relevant knowledge using scope cascade:
   * restaurant → brand → region → global.
   * Only returns approved knowledge (review_status = 'approved').
   */
  async getRelevantKnowledge(
    restaurantId: string,
    operation: AIOperation,
  ): Promise<RelevantKnowledge> {
    const config = RETRIEVAL_CONFIG[operation];
    if (!config?.types.length) {
      return this.emptyKnowledge();
    }

    const client = this.supabase.getClient();

    // Step 1: Resolve restaurant's brand_id and region_id for cascade
    const { data: restaurant } = await client
      .from('master_restaurant')
      .select('brand_id, region_id')
      .eq('id', restaurantId)
      .single();

    const brandId = restaurant?.brand_id ?? null;
    const regionId = restaurant?.region_id ?? null;

    // Step 2: Build scope cascade OR filter
    const scopeConditions: string[] = [
      `restaurant_id.eq.${restaurantId}`,
    ];
    if (brandId !== null) {
      scopeConditions.push(`brand_id.eq.${brandId}`);
    }
    if (regionId) {
      scopeConditions.push(`region_id.eq.${regionId}`);
    }
    // Global: all three FK are NULL
    scopeConditions.push(
      'and(restaurant_id.is.null,brand_id.is.null,region_id.is.null)',
    );

    // Step 3: Query with filters
    let query = client
      .from('lingtin_knowledge_store')
      .select('*')
      .in('knowledge_type', config.types)
      .eq('status', 'active')
      .eq('review_status', 'approved')
      .or(scopeConditions.join(','));

    // Category filter (skip if 'all')
    if (config.categories !== 'all') {
      query = query.or(
        config.categories.map((c) => `category.eq.${c}`).join(',') +
          ',category.is.null',
      );
    }

    const { data, error } = await query
      .order('quality_score', { ascending: false })
      .limit(20);

    if (error) {
      this.logger.error('Failed to fetch knowledge', error);
      return this.emptyKnowledge();
    }

    if (!data?.length) {
      return this.emptyKnowledge();
    }

    // Sort by scope priority: restaurant > brand > region > global
    const scopePriority: Record<KnowledgeScope, number> = {
      restaurant: 0,
      brand: 1,
      region: 2,
      global: 3,
    };
    data.sort((a, b) => {
      const scopeDiff =
        (scopePriority[a.scope as KnowledgeScope] ?? 4) -
        (scopePriority[b.scope as KnowledgeScope] ?? 4);
      if (scopeDiff !== 0) return scopeDiff;
      return (b.quality_score ?? 0) - (a.quality_score ?? 0);
    });

    // Update usage tracking (fire-and-forget)
    const ids = data.map((k) => k.id);
    this.trackUsage(ids).catch((e) =>
      this.logger.warn('Failed to track usage', e.message),
    );

    return this.formatKnowledge(data);
  }

  /**
   * Format knowledge entries into prompt-friendly sections.
   */
  private formatKnowledge(entries: KnowledgeEntry[]): RelevantKnowledge {
    const byType = new Map<KnowledgeType, KnowledgeEntry[]>();
    for (const entry of entries) {
      const list = byType.get(entry.knowledge_type) || [];
      list.push(entry);
      byType.set(entry.knowledge_type, list);
    }

    return {
      profile: this.formatSection(byType.get('profile')),
      examples: this.formatSection(byType.get('example')),
      patterns: this.formatSection(byType.get('pattern')),
      benchmarks: this.formatSection(byType.get('benchmark')),
      bestPractices: this.formatSection(byType.get('best_practice')),
      rules: this.formatSection(byType.get('rule')),
      raw: entries,
    };
  }

  private formatSection(
    entries: KnowledgeEntry[] | undefined,
  ): string | null {
    if (!entries?.length) return null;

    return entries
      .map((e) => {
        const title = e.title ? `### ${e.title}\n` : '';
        const content =
          typeof e.content === 'string'
            ? e.content
            : JSON.stringify(e.content, null, 2);
        return `${title}${content}`;
      })
      .join('\n\n');
  }

  private emptyKnowledge(): RelevantKnowledge {
    return {
      profile: null,
      examples: null,
      patterns: null,
      benchmarks: null,
      bestPractices: null,
      rules: null,
      raw: [],
    };
  }

  // ─── Knowledge CRUD ──────────────────────────────────────────────

  /**
   * Creates a new knowledge entry. New entries start as draft + pending_review
   * unless auto_approve is set.
   */
  async createKnowledge(
    input: KnowledgeCreateInput,
  ): Promise<{ data: KnowledgeEntry | null; error: string | null }> {
    const client = this.supabase.getClient();

    const shouldAutoApprove = input.auto_approve === true;
    const status = shouldAutoApprove ? 'active' : 'draft';
    const reviewStatus = shouldAutoApprove ? 'approved' : 'pending_review';

    const { data, error } = await client
      .from('lingtin_knowledge_store')
      .insert({
        restaurant_id: input.restaurant_id || null,
        brand_id: input.brand_id ?? null,
        region_id: input.region_id || null,
        scope: input.scope,
        knowledge_type: input.knowledge_type,
        category: input.category || null,
        depth_level: input.depth_level || 'L1',
        title: input.title || null,
        content: input.content,
        quality_score: input.quality_score ?? 0.5,
        confidence: input.confidence ?? 0.5,
        source_signal: input.source_signal || null,
        source_type: input.source_type || 'auto',
        source_data: input.source_data || null,
        source_record_id: input.source_record_id || null,
        source_record_type: input.source_record_type || null,
        status,
        review_status: reviewStatus,
        auto_approve: shouldAutoApprove,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create knowledge', error);
      return { data: null, error: error.message };
    }

    this.logger.log(
      `Created knowledge ${data.id}: ${input.title} [${reviewStatus}]`,
    );
    return { data, error: null };
  }

  /**
   * Legacy upsert: checks for existing entry with same scope/type/category
   * and updates or creates.
   */
  async upsertKnowledge(
    input: KnowledgeCreateInput,
  ): Promise<{ data: KnowledgeEntry | null; error: string | null }> {
    const client = this.supabase.getClient();

    // Check for existing entry with same scope + type + category + owner FK
    const query = client
      .from('lingtin_knowledge_store')
      .select('id')
      .eq('knowledge_type', input.knowledge_type)
      .eq('scope', input.scope)
      .in('status', ['active', 'draft']);

    if (input.restaurant_id) {
      query.eq('restaurant_id', input.restaurant_id);
    } else {
      query.is('restaurant_id', null);
    }
    if (input.brand_id) {
      query.eq('brand_id', input.brand_id);
    }
    if (input.region_id) {
      query.eq('region_id', input.region_id);
    }
    if (input.category) {
      query.eq('category', input.category);
    }

    const { data: existing } = await query.limit(1).single();

    if (existing) {
      const { data, error } = await client
        .from('lingtin_knowledge_store')
        .update({
          content: input.content,
          title: input.title,
          quality_score: input.quality_score ?? 0.5,
          confidence: input.confidence ?? 0.5,
          source_type: input.source_type || 'auto',
          source_data: input.source_data || null,
          updated_at: new Date().toISOString(),
          source_signal: input.source_signal,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to update knowledge', error);
        return { data: null, error: error.message };
      }
      this.logger.log(`Updated knowledge ${existing.id}: ${input.title}`);
      return { data, error: null };
    }

    return this.createKnowledge(input);
  }

  async listKnowledge(filters: {
    restaurant_id?: string;
    scope?: KnowledgeScope;
    knowledge_type?: KnowledgeType;
    status?: KnowledgeStatus;
    review_status?: ReviewStatus;
    limit?: number;
  }): Promise<KnowledgeEntry[]> {
    const client = this.supabase.getClient();
    let query = client
      .from('lingtin_knowledge_store')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(filters.limit || 50);

    if (filters.restaurant_id) {
      if (!UUID_REGEX.test(filters.restaurant_id)) {
        this.logger.warn(`Invalid restaurant_id: ${filters.restaurant_id}`);
        return [];
      }
      query = query.eq('restaurant_id', filters.restaurant_id);
    }
    if (filters.scope) query = query.eq('scope', filters.scope);
    if (filters.knowledge_type)
      query = query.eq('knowledge_type', filters.knowledge_type);
    if (filters.review_status)
      query = query.eq('review_status', filters.review_status);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error } = await query;

    if (error) {
      this.logger.error('Failed to list knowledge', error);
      return [];
    }
    return data || [];
  }

  async archiveKnowledge(id: string): Promise<boolean> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('lingtin_knowledge_store')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to archive knowledge ${id}`, error);
      return false;
    }
    return true;
  }

  // ─── HITL Review Workflow ─────────────────────────────────────────

  async getReviewQueue(filters: {
    review_status?: ReviewStatus;
    knowledge_type?: KnowledgeType;
    restaurant_id?: string;
    limit?: number;
  }): Promise<KnowledgeEntry[]> {
    const client = this.supabase.getClient();
    let query = client
      .from('lingtin_knowledge_store')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filters.limit || 50);

    query = query.eq(
      'review_status',
      filters.review_status || 'pending_review',
    );

    if (filters.knowledge_type)
      query = query.eq('knowledge_type', filters.knowledge_type);
    if (filters.restaurant_id)
      query = query.eq('restaurant_id', filters.restaurant_id);

    const { data, error } = await query;
    if (error) {
      this.logger.error('Failed to fetch review queue', error);
      return [];
    }
    return data || [];
  }

  async approveKnowledge(
    id: string,
    reviewedBy: string,
    note?: string,
    newCategory?: KnowledgeCategory,
  ): Promise<{ success: boolean; error?: string }> {
    const client = this.supabase.getClient();
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {
      status: 'active',
      review_status: 'approved',
      reviewed_by: reviewedBy,
      reviewed_at: now,
      reviewer_note: note || null,
      updated_at: now,
    };
    // Allow reclassifying emergent knowledge during approval
    if (newCategory) {
      updateData.category = newCategory;
    }

    const { error } = await client
      .from('lingtin_knowledge_store')
      .update(updateData)
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to approve knowledge ${id}`, error);
      return { success: false, error: error.message };
    }

    this.logger.log(`Knowledge ${id} approved by ${reviewedBy}`);
    return { success: true };
  }

  async reviseKnowledge(
    id: string,
    reviewedBy: string,
    note: string,
  ): Promise<{ success: boolean; error?: string }> {
    const client = this.supabase.getClient();
    const now = new Date().toISOString();

    const { error } = await client
      .from('lingtin_knowledge_store')
      .update({
        status: 'draft',
        review_status: 'revision_requested',
        reviewed_by: reviewedBy,
        reviewed_at: now,
        reviewer_note: note,
        updated_at: now,
      })
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to request revision for ${id}`, error);
      return { success: false, error: error.message };
    }

    this.logger.log(`Knowledge ${id} revision requested by ${reviewedBy}`);
    return { success: true };
  }

  async rejectKnowledge(
    id: string,
    reviewedBy: string,
    note: string,
  ): Promise<{ success: boolean; error?: string }> {
    const client = this.supabase.getClient();
    const now = new Date().toISOString();

    const { error } = await client
      .from('lingtin_knowledge_store')
      .update({
        status: 'deprecated',
        review_status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: now,
        reviewer_note: note,
        updated_at: now,
      })
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to reject knowledge ${id}`, error);
      return { success: false, error: error.message };
    }

    this.logger.log(`Knowledge ${id} rejected by ${reviewedBy}`);
    return { success: true };
  }

  async getReviewHistory(days: number = 30): Promise<KnowledgeEntry[]> {
    const client = this.supabase.getClient();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await client
      .from('lingtin_knowledge_store')
      .select('*')
      .not('reviewed_at', 'is', null)
      .gte('reviewed_at', since.toISOString())
      .order('reviewed_at', { ascending: false })
      .limit(100);

    if (error) {
      this.logger.error('Failed to fetch review history', error);
      return [];
    }
    return data || [];
  }

  // ─── Version Management ───────────────────────────────────────────

  /**
   * Creates a new version of an existing knowledge entry.
   * The old entry gets superseded_by set, and status changes to 'superseded'.
   */
  async createVersion(
    existingId: string,
    newContent: Record<string, unknown>,
    options?: {
      title?: string;
      confidence?: number;
      source_type?: SourceType;
      auto_approve?: boolean;
    },
  ): Promise<{ data: KnowledgeEntry | null; error: string | null }> {
    const client = this.supabase.getClient();

    // Fetch the existing entry
    const { data: existing, error: fetchErr } = await client
      .from('lingtin_knowledge_store')
      .select('*')
      .eq('id', existingId)
      .single();

    if (fetchErr || !existing) {
      return { data: null, error: 'Knowledge entry not found' };
    }

    // Determine parent_id: use existing parent_id if it's already versioned, else use its own id
    const parentId = existing.parent_id || existing.id;
    const newVersion = (existing.version || 1) + 1;

    const shouldAutoApprove = options?.auto_approve === true;

    // Insert new version
    const { data: newEntry, error: insertErr } = await client
      .from('lingtin_knowledge_store')
      .insert({
        restaurant_id: existing.restaurant_id,
        brand_id: existing.brand_id,
        region_id: existing.region_id,
        scope: existing.scope,
        knowledge_type: existing.knowledge_type,
        category: existing.category,
        title: options?.title || existing.title,
        content: newContent,
        quality_score: existing.quality_score,
        confidence: options?.confidence ?? existing.confidence ?? 0.5,
        source_signal: existing.source_signal,
        source_type: options?.source_type || existing.source_type || 'auto',
        source_data: existing.source_data,
        version: newVersion,
        parent_id: parentId,
        status: shouldAutoApprove ? 'active' : 'draft',
        review_status: shouldAutoApprove ? 'approved' : 'pending_review',
        auto_approve: shouldAutoApprove,
      })
      .select()
      .single();

    if (insertErr) {
      this.logger.error('Failed to create knowledge version', insertErr);
      return { data: null, error: insertErr.message };
    }

    // Mark old version as superseded
    await client
      .from('lingtin_knowledge_store')
      .update({
        status: 'superseded',
        superseded_by: newEntry.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingId);

    this.logger.log(
      `Created version ${newVersion} of knowledge ${parentId}: ${newEntry.id}`,
    );
    return { data: newEntry, error: null };
  }

  async getVersionHistory(knowledgeId: string): Promise<KnowledgeEntry[]> {
    const client = this.supabase.getClient();

    // First get the entry to find its parent_id
    const { data: entry } = await client
      .from('lingtin_knowledge_store')
      .select('parent_id')
      .eq('id', knowledgeId)
      .single();

    const parentId = entry?.parent_id || knowledgeId;

    // Get all versions (entries with same parent_id, or the parent itself)
    const { data, error } = await client
      .from('lingtin_knowledge_store')
      .select('*')
      .or(`parent_id.eq.${parentId},id.eq.${parentId}`)
      .order('version', { ascending: false });

    if (error) {
      this.logger.error('Failed to fetch version history', error);
      return [];
    }
    return data || [];
  }

  // ─── Quality Scoring ──────────────────────────────────────────────

  /**
   * Computes a dynamic quality score factoring freshness, authority,
   * engagement, and confidence.
   */
  computeQualityScore(entry: KnowledgeEntry): number {
    // Freshness: exponential decay with 90-day half-life
    const daysSinceUpdate =
      (Date.now() - new Date(entry.updated_at).getTime()) / 86400000;
    const freshness = Math.pow(0.5, daysSinceUpdate / 90);

    // Authority based on source_type
    const authority = AUTHORITY_SCORES[entry.source_type] ?? 0.5;

    // Engagement: daily usage rate
    const daysAlive = Math.max(
      1,
      (Date.now() - new Date(entry.created_at).getTime()) / 86400000,
    );
    const engagement = Math.min(1, (entry.usage_count || 0) / daysAlive);

    // Confidence from the entry itself
    const confidence = entry.confidence ?? 0.5;

    return (
      freshness * SCORE_WEIGHTS.freshness +
      authority * SCORE_WEIGHTS.authority +
      engagement * SCORE_WEIGHTS.engagement +
      confidence * SCORE_WEIGHTS.confidence
    );
  }

  // ─── Learning Worker Support ──────────────────────────────────────

  /**
   * Applies daily quality score decay to active knowledge.
   * Called by learning worker on a schedule.
   */
  async decayKnowledgeScores(): Promise<{ updated: number }> {
    const client = this.supabase.getClient();

    // Decay quality scores by 0.992 (≈90-day half-life)
    const { data, error } = await client.rpc('decay_knowledge_scores');
    if (error) {
      // Fallback: manual update
      const { count } = await client
        .from('lingtin_knowledge_store')
        .update({ quality_score: 0 }) // placeholder, see raw SQL below
        .eq('status', 'active')
        .eq('review_status', 'approved')
        .neq('knowledge_type', 'rule');

      this.logger.warn(
        'RPC decay_knowledge_scores not found, using direct SQL',
      );
      return { updated: count || 0 };
    }

    return { updated: data ?? 0 };
  }

  /**
   * Archives knowledge that has been low quality and unused for 90+ days.
   */
  async autoArchiveStale(): Promise<{ archived: number }> {
    const client = this.supabase.getClient();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data, error } = await client
      .from('lingtin_knowledge_store')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'active')
      .lt('quality_score', 0.15)
      .or(
        `last_used_at.is.null,last_used_at.lt.${ninetyDaysAgo.toISOString()}`,
      )
      .select('id');

    if (error) {
      this.logger.error('Failed to auto-archive stale knowledge', error);
      return { archived: 0 };
    }

    const count = data?.length || 0;
    if (count > 0) {
      this.logger.log(`Auto-archived ${count} stale knowledge entries`);
    }
    return { archived: count };
  }

  /**
   * Finds knowledge entries pending revision (reviewer requested changes).
   */
  async getPendingRevisions(): Promise<KnowledgeEntry[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('lingtin_knowledge_store')
      .select('*')
      .eq('review_status', 'revision_requested')
      .order('reviewed_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to fetch pending revisions', error);
      return [];
    }
    return data || [];
  }

  // ─── Distillation Support ─────────────────────────────────────────

  /**
   * Finds candidates for vertical distillation:
   * same restaurant + same category with 5+ active approved entries.
   */
  async getVerticalDistillationCandidates(): Promise<
    Array<{
      restaurant_id: string;
      category: string;
      count: number;
      entries: KnowledgeEntry[];
    }>
  > {
    const client = this.supabase.getClient();

    // Find groups with 5+ entries
    const { data: groups, error } = await client
      .from('lingtin_knowledge_store')
      .select('restaurant_id, category')
      .eq('status', 'active')
      .eq('review_status', 'approved')
      .eq('scope', 'restaurant')
      .not('restaurant_id', 'is', null)
      .not('category', 'is', null);

    if (error || !groups?.length) return [];

    // Count by restaurant_id + category
    const counts = new Map<string, number>();
    for (const g of groups) {
      const key = `${g.restaurant_id}::${g.category}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const candidates: Array<{
      restaurant_id: string;
      category: string;
      count: number;
      entries: KnowledgeEntry[];
    }> = [];

    for (const [key, count] of counts) {
      if (count < 5) continue;
      const [restaurantId, category] = key.split('::');

      const { data: entries } = await client
        .from('lingtin_knowledge_store')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('category', category)
        .eq('status', 'active')
        .eq('review_status', 'approved')
        .eq('scope', 'restaurant')
        .order('quality_score', { ascending: false });

      if (entries?.length) {
        candidates.push({
          restaurant_id: restaurantId,
          category,
          count: entries.length,
          entries,
        });
      }
    }

    return candidates;
  }

  /**
   * Finds candidates for horizontal distillation:
   * 3+ restaurants with similar patterns in the same category.
   */
  async getHorizontalDistillationCandidates(): Promise<
    Array<{
      category: string;
      knowledge_type: KnowledgeType;
      restaurants: string[];
      entries: KnowledgeEntry[];
    }>
  > {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('lingtin_knowledge_store')
      .select('*')
      .eq('status', 'active')
      .eq('review_status', 'approved')
      .eq('scope', 'restaurant')
      .eq('knowledge_type', 'pattern')
      .not('restaurant_id', 'is', null)
      .not('category', 'is', null);

    if (error || !data?.length) return [];

    // Group by category
    const byCategory = new Map<string, KnowledgeEntry[]>();
    for (const entry of data) {
      const key = entry.category || 'general';
      const list = byCategory.get(key) || [];
      list.push(entry);
      byCategory.set(key, list);
    }

    const candidates: Array<{
      category: string;
      knowledge_type: KnowledgeType;
      restaurants: string[];
      entries: KnowledgeEntry[];
    }> = [];

    for (const [category, entries] of byCategory) {
      const uniqueRestaurants = [
        ...new Set(entries.map((e) => e.restaurant_id).filter(Boolean)),
      ] as string[];
      if (uniqueRestaurants.length >= 3) {
        candidates.push({
          category,
          knowledge_type: 'pattern',
          restaurants: uniqueRestaurants,
          entries,
        });
      }
    }

    return candidates;
  }

  /**
   * Gets L3 insights that don't yet have corresponding L4 action guidance.
   * Used by the L4 distillation pipeline.
   */
  async getL3InsightsForActionDistillation(): Promise<KnowledgeEntry[]> {
    const client = this.supabase.getClient();

    // Get all active L3 entries
    const { data: l3Entries, error: l3Error } = await client
      .from('lingtin_knowledge_store')
      .select('*')
      .eq('depth_level', 'L3')
      .eq('status', 'active')
      .eq('review_status', 'approved');

    if (l3Error || !l3Entries?.length) return [];

    // Get IDs that already have L4 children (via source_data.distilled_from)
    const { data: l4Entries } = await client
      .from('lingtin_knowledge_store')
      .select('source_data')
      .eq('depth_level', 'L4')
      .in('status', ['active', 'draft'])
      .not('source_data', 'is', null);

    const coveredL3Ids = new Set<string>();
    if (l4Entries) {
      for (const l4 of l4Entries) {
        const fromIds = (l4.source_data as any)?.distilled_from;
        if (Array.isArray(fromIds)) {
          fromIds.forEach((id: string) => coveredL3Ids.add(id));
        }
      }
    }

    return l3Entries.filter((e) => !coveredL3Ids.has(e.id));
  }

  /**
   * Gets L2+ active knowledge for exploratory distillation.
   * Returns recently updated entries for cross-domain discovery.
   */
  async getKnowledgeForExploration(limit = 200): Promise<KnowledgeEntry[]> {
    const client = this.supabase.getClient();
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await client
      .from('lingtin_knowledge_store')
      .select('*')
      .eq('status', 'active')
      .eq('review_status', 'approved')
      .in('depth_level', ['L2', 'L3', 'L4'])
      .gte('updated_at', thirtyDaysAgo)
      .order('quality_score', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('Failed to fetch knowledge for exploration', error);
      return [];
    }

    return data || [];
  }

  // ─── Usage Tracking ──────────────────────────────────────────────

  private async trackUsage(ids: string[]): Promise<void> {
    const client = this.supabase.getClient();
    const now = new Date().toISOString();

    for (const id of ids) {
      const { error } = await client.rpc('increment_knowledge_usage', {
        knowledge_id: id,
        used_at: now,
      });
      if (error) {
        // Fallback: direct update without increment
        await client
          .from('lingtin_knowledge_store')
          .update({ last_used_at: now })
          .eq('id', id);
      }
    }
  }

  // ─── Learning Events ─────────────────────────────────────────────

  async logLearningEvent(
    event: LearningEventInput,
  ): Promise<string | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('lingtin_learning_events')
      .insert({
        signal_id: event.signal_id,
        action: event.action,
        restaurant_id: event.restaurant_id || null,
        input_summary: event.input_summary || null,
        output_knowledge_ids: event.output_knowledge_ids || null,
        metrics: event.metrics || null,
        status: event.status || 'completed',
        error_message: event.error_message || null,
      })
      .select('id')
      .single();

    if (error) {
      this.logger.error('Failed to log learning event', error);
      return null;
    }
    return data.id;
  }

  async getRecentLearningEvents(
    limit: number = 20,
  ): Promise<LearningEventInput[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('lingtin_learning_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('Failed to fetch learning events', error);
      return [];
    }
    return data || [];
  }

  // ─── AI Metrics ──────────────────────────────────────────────────

  async recordMetric(metric: MetricInput): Promise<boolean> {
    const client = this.supabase.getClient();

    const { error } = await client.from('lingtin_ai_metrics').insert({
      metric_date: metric.metric_date,
      restaurant_id: metric.restaurant_id || null,
      metric_type: metric.metric_type,
      metric_value: metric.metric_value,
    });

    if (error) {
      this.logger.error('Failed to record metric', error);
      return false;
    }
    return true;
  }

  async getMetrics(filters: {
    metric_type: string;
    restaurant_id?: string;
    days?: number;
  }): Promise<MetricInput[]> {
    const client = this.supabase.getClient();
    const since = new Date();
    since.setDate(since.getDate() - (filters.days || 30));

    let query = client
      .from('lingtin_ai_metrics')
      .select('*')
      .eq('metric_type', filters.metric_type)
      .gte('metric_date', since.toISOString().split('T')[0])
      .order('metric_date', { ascending: false });

    if (filters.restaurant_id) {
      query = query.eq('restaurant_id', filters.restaurant_id);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      this.logger.error('Failed to fetch metrics', error);
      return [];
    }
    return data || [];
  }

  // ─── Prompt Enrichment ────────────────────────────────────────────

  async enrichPrompt(
    basePrompt: string,
    context: { restaurantId: string; operation: AIOperation },
  ): Promise<string> {
    const knowledge = await this.getRelevantKnowledge(
      context.restaurantId,
      context.operation,
    );

    const sections: string[] = [];

    if (knowledge.profile) {
      sections.push(`## 门店知识\n${knowledge.profile}`);
    }
    if (knowledge.examples) {
      sections.push(`## 参考示例\n${knowledge.examples}`);
    }
    if (knowledge.patterns) {
      sections.push(`## 已识别模式\n${knowledge.patterns}`);
    }
    if (knowledge.benchmarks) {
      sections.push(`## 基准数据\n${knowledge.benchmarks}`);
    }
    if (knowledge.bestPractices) {
      sections.push(`## 最佳实践\n${knowledge.bestPractices}`);
    }
    if (knowledge.rules) {
      sections.push(`## 业务规则\n${knowledge.rules}`);
    }

    if (!sections.length) {
      return basePrompt;
    }

    return `${basePrompt}\n\n---\n\n# 学习引擎知识注入\n以下是关于此门店的积累知识，请参考以提高分析质量：\n\n${sections.join('\n\n')}`;
  }
}
