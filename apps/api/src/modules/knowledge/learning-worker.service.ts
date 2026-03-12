import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { KnowledgeService, KnowledgeEntry } from './knowledge.service';
import { SupabaseService } from '../../common/supabase/supabase.service';

const BARK_DEVICE_KEY = process.env.BARK_DEVICE_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

@Injectable()
export class LearningWorkerService {
  private readonly logger = new Logger(LearningWorkerService.name);

  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly supabase: SupabaseService,
  ) {}

  // ─── Scheduled Tasks ──────────────────────────────────────────────

  /**
   * Daily quality score decay + auto-archive stale knowledge.
   * Runs at 03:00 UTC (11:00 CST).
   */
  @Cron('0 3 * * *')
  async runDailyDecay() {
    this.logger.log('Running daily knowledge decay...');
    const decay = await this.knowledgeService.decayKnowledgeScores();
    const archive = await this.knowledgeService.autoArchiveStale();
    this.logger.log(
      `Decay complete: ${decay.updated} decayed, ${archive.archived} archived`,
    );
  }

  /**
   * Process pending revisions: detect revision_requested items,
   * re-generate content based on reviewer notes.
   * Runs at 04:00 UTC (12:00 CST).
   */
  @Cron('0 4 * * *')
  async processRevisions() {
    const revisions = await this.knowledgeService.getPendingRevisions();
    if (!revisions.length) return;

    this.logger.log(`Processing ${revisions.length} pending revisions...`);

    for (const entry of revisions) {
      try {
        const revisedContent = await this.regenerateContent(entry);
        if (!revisedContent) continue;

        // Create new version with revised content
        await this.knowledgeService.createVersion(entry.id, revisedContent, {
          title: entry.title || undefined,
          confidence: entry.confidence,
          source_type: entry.source_type as 'auto' | 'manual' | 'promoted' | 'distilled',
        });

        await this.sendBark(
          '🔄 知识已修订',
          `${entry.title || entry.knowledge_type}\n根据审核意见重新生成，请复审`,
        );
      } catch (e) {
        this.logger.error(`Failed to revise knowledge ${entry.id}`, e);
      }
    }
  }

  /**
   * Weekly exploratory distillation.
   * Runs at 05:00 UTC every Sunday (13:00 CST).
   */
  @Cron('0 5 * * 0')
  async runWeeklyExploration() {
    this.logger.log('Running weekly exploratory distillation...');
    const result = await this.runExploratoryDistillation();
    this.logger.log(`Exploratory distillation complete: ${result.discovered} discoveries`);
  }

  /**
   * Daily auto-distillation: L1→L2 vertical, L2→L3 horizontal, L3→L4 action.
   * Runs at 04:30 UTC (12:30 CST), after revisions processing.
   */
  @Cron('30 4 * * *')
  async runAutoDistill() {
    this.logger.log('Running daily auto-distillation...');
    const result = await this.triggerDistillation();
    const total = result.vertical + result.horizontal + result.action;
    if (total > 0) {
      this.logger.log(`Auto-distillation complete: ${total} total`);
    }
  }

  /**
   * Daily action item impact evaluation.
   * Checks resolved items 3-7 days ago and evaluates sentiment change.
   * Runs at 06:00 UTC (14:00 CST).
   */
  @Cron('0 6 * * *')
  async evaluateActionImpact() {
    this.logger.log('Evaluating action item impact...');
    try {
      const client = this.supabase.getClient();

      // Find resolved action items 3-7 days ago that haven't been tracked
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

      const { data: items, error } = await client
        .from('lingtin_action_items')
        .select('id, restaurant_id, category, resolved_at, resolved_note, suggestion_text')
        .eq('status', 'resolved')
        .eq('impact_tracked', false)
        .gte('resolved_at', sevenDaysAgo)
        .lte('resolved_at', threeDaysAgo)
        .limit(50);

      if (error || !items?.length) {
        this.logger.log(`No action items to evaluate impact for`);
        return;
      }

      let tracked = 0;
      for (const item of items) {
        try {
          // Compare sentiment before and after resolution
          const resolvedDate = new Date(item.resolved_at);
          const beforeStart = new Date(resolvedDate.getTime() - 7 * 86400000).toISOString();
          const afterEnd = new Date().toISOString();

          const { data: beforeVisits } = await client
            .from('lingtin_visit_records')
            .select('sentiment_score')
            .eq('restaurant_id', item.restaurant_id)
            .gte('created_at', beforeStart)
            .lt('created_at', item.resolved_at)
            .not('sentiment_score', 'is', null);

          const { data: afterVisits } = await client
            .from('lingtin_visit_records')
            .select('sentiment_score')
            .eq('restaurant_id', item.restaurant_id)
            .gte('created_at', item.resolved_at)
            .lte('created_at', afterEnd)
            .not('sentiment_score', 'is', null);

          const avgBefore = beforeVisits?.length
            ? beforeVisits.reduce((s, v) => s + v.sentiment_score, 0) / beforeVisits.length
            : null;
          const avgAfter = afterVisits?.length
            ? afterVisits.reduce((s, v) => s + v.sentiment_score, 0) / afterVisits.length
            : null;

          const impactResult = {
            avg_sentiment_before: avgBefore,
            avg_sentiment_after: avgAfter,
            delta: avgBefore !== null && avgAfter !== null ? avgAfter - avgBefore : null,
            before_count: beforeVisits?.length || 0,
            after_count: afterVisits?.length || 0,
            evaluated_at: new Date().toISOString(),
          };

          await client
            .from('lingtin_action_items')
            .update({ impact_tracked: true, impact_result: impactResult })
            .eq('id', item.id);

          // If positive improvement > 5 points, mark related experience knowledge as verified
          if (impactResult.delta !== null && impactResult.delta > 5) {
            const { data: relatedKnowledge } = await client
              .from('lingtin_knowledge_store')
              .select('id, content')
              .eq('source_record_id', item.id)
              .eq('source_record_type', 'action_item')
              .limit(1)
              .single();

            if (relatedKnowledge) {
              const updatedContent = {
                ...relatedKnowledge.content as Record<string, unknown>,
                impact_verified: true,
                impact_delta: impactResult.delta,
                impact_evaluated_at: impactResult.evaluated_at,
              };
              await client
                .from('lingtin_knowledge_store')
                .update({
                  content: updatedContent,
                  quality_score: 0.85,
                  confidence: 0.9,
                })
                .eq('id', relatedKnowledge.id);
            }
          }

          tracked++;
        } catch (e) {
          this.logger.warn(`Impact evaluation failed for action ${item.id}`, e);
        }
      }

      this.logger.log(`Impact evaluation complete: ${tracked}/${items.length} tracked`);
    } catch (e) {
      this.logger.error('evaluateActionImpact failed', e);
    }
  }

  // ─── Manual Triggers ──────────────────────────────────────────────

  /**
   * Manually trigger distillation. Called from controller endpoint.
   * Orchestrates: vertical (L1→L2) → horizontal (L2→L3) → L4 action → exploration.
   */
  async triggerDistillation(): Promise<{
    vertical: number;
    horizontal: number;
    action: number;
  }> {
    this.logger.log('Running knowledge distillation...');

    let verticalCount = 0;
    let horizontalCount = 0;
    let actionCount = 0;

    // Vertical distillation: same restaurant, 5+ entries of same category → L2
    const verticalCandidates =
      await this.knowledgeService.getVerticalDistillationCandidates();
    for (const candidate of verticalCandidates) {
      try {
        const distilled = await this.distillVertical(candidate);
        if (distilled) verticalCount++;
      } catch (e) {
        this.logger.error(
          `Vertical distillation failed for ${candidate.restaurant_id}/${candidate.category}`,
          e,
        );
      }
    }

    // Horizontal distillation: 3+ restaurants with similar patterns → L3
    // (also auto-triggers L4 action distillation for each new L3)
    const horizontalCandidates =
      await this.knowledgeService.getHorizontalDistillationCandidates();
    for (const candidate of horizontalCandidates) {
      try {
        const distilled = await this.distillHorizontal(candidate);
        if (distilled) horizontalCount++;
      } catch (e) {
        this.logger.error(
          `Horizontal distillation failed for ${candidate.category}`,
          e,
        );
      }
    }

    // L4 action guidance: L3 insights without corresponding L4
    const l3Insights =
      await this.knowledgeService.getL3InsightsForActionDistillation();
    for (const insight of l3Insights) {
      try {
        const distilled = await this.distillActionGuidance(insight);
        if (distilled) actionCount++;
      } catch (e) {
        this.logger.error(
          `L4 distillation failed for insight ${insight.id}`,
          e,
        );
      }
    }

    const total = verticalCount + horizontalCount + actionCount;
    if (total > 0) {
      await this.sendBark(
        '🧪 知识蒸馏完成',
        `纵向L2 ${verticalCount} 条，横向L3 ${horizontalCount} 条，行动L4 ${actionCount} 条\n请在管理面板审核`,
      );
    }

    this.logger.log(
      `Distillation complete: ${verticalCount} vertical(L2), ${horizontalCount} horizontal(L3), ${actionCount} action(L4)`,
    );
    return { vertical: verticalCount, horizontal: horizontalCount, action: actionCount };
  }

  // ─── Vertical Distillation (L1→L2) ─────────────────────────────

  private async distillVertical(candidate: {
    restaurant_id: string;
    category: string;
    entries: KnowledgeEntry[];
  }): Promise<boolean> {
    const entrySummaries = candidate.entries
      .map(
        (e) =>
          `- ${e.title || e.knowledge_type}: ${JSON.stringify(e.content)}`,
      )
      .join('\n');

    const prompt = `你是餐饮行业知识管理专家。以下是同一门店 (${candidate.category} 类别) 的多条零散事实(L1)，请归纳提炼为一条结构化的规律性知识(L2)。

注意：L2 规律应该反映反复出现的模式，而非简单罗列事实。

原始知识：
${entrySummaries}

请输出JSON格式（只输出JSON，无其他内容）：
{
  "title": "精炼后的规律标题",
  "summary": "规律性总结（100字以内，强调模式而非个别事实）",
  "key_points": ["关键规律1", "关键规律2", ...],
  "confidence": 0.7到0.95之间的数值（基于证据充分度）,
  "trend": "上升/下降/稳定/无明显趋势"
}`;

    const result = await this.callDeepSeek(prompt);
    if (!result) return false;

    const parsed = this.parseJSON(result);
    if (!parsed) return false;

    await this.knowledgeService.createKnowledge({
      restaurant_id: candidate.restaurant_id,
      scope: 'restaurant',
      knowledge_type: 'profile',
      category: candidate.category as any,
      depth_level: 'L2',
      title: parsed.title || `${candidate.category} 综合画像`,
      content: {
        summary: parsed.summary,
        key_points: parsed.key_points,
        trend: parsed.trend,
        distilled_from: candidate.entries.map((e) => e.id),
      },
      confidence: parsed.confidence || 0.75,
      source_type: 'distilled',
      source_data: {
        distilled_from: candidate.entries.map((e) => e.id),
        distillation_type: 'vertical',
        depth_transition: 'L1→L2',
        source_count: candidate.entries.length,
      },
    });

    await this.knowledgeService.logLearningEvent({
      signal_id: `distill-vertical-${candidate.restaurant_id}-${candidate.category}`,
      action: 'vertical_distillation_L2',
      restaurant_id: candidate.restaurant_id,
      input_summary: `Distilled ${candidate.entries.length} L1 entries → L2 in ${candidate.category}`,
      output_knowledge_ids: [],
      status: 'completed',
    });

    return true;
  }

  // ─── Horizontal Distillation (L2→L3, Gemini Flash) ──────────────

  private async distillHorizontal(candidate: {
    category: string;
    knowledge_type: string;
    restaurants: string[];
    entries: KnowledgeEntry[];
  }): Promise<boolean> {
    const entrySummaries = candidate.entries
      .map(
        (e) =>
          `- 门店${e.restaurant_id?.slice(0, 8)}: ${e.title || e.knowledge_type}: ${JSON.stringify(e.content)}`,
      )
      .join('\n');

    const prompt = `你是餐饮行业深度分析专家。以下是 ${candidate.restaurants.length} 个门店在 "${candidate.category}" 类别中的相似规律(L2)。

请进行深度推理，产出一条品牌级洞察(L3)——不仅要归纳共性，更要推理出背后的原因和动机。

各门店的规律：
${entrySummaries}

请深度思考后输出JSON格式（只输出JSON，无其他内容）：
{
  "title": "品牌级洞察标题",
  "description": "洞察描述（150字以内，重点说明'为什么'而非'是什么'）",
  "affected_store_count": ${candidate.restaurants.length},
  "commonality": "各门店的共性总结",
  "hypothesis": "深层根因分析——消费者为什么这样做？门店为什么出现这种模式？",
  "causal_chain": "因果链推理（如：商圈特征→客群构成→消费行为→反馈模式）",
  "confidence": 0.5到0.85之间的数值
}`;

    const result = await this.callGeminiFlash(prompt);
    if (!result) return false;

    const parsed = this.parseJSON(result);
    if (!parsed) return false;

    // Get brand_id from the first entry's restaurant
    const client = this.supabase.getClient();
    const { data: restaurant } = await client
      .from('master_restaurant')
      .select('brand_id')
      .eq('id', candidate.restaurants[0])
      .single();

    const brandId = restaurant?.brand_id ?? null;

    const { data: newEntry } = await this.knowledgeService.createKnowledge({
      brand_id: brandId,
      scope: brandId ? 'brand' : 'global',
      knowledge_type: 'pattern',
      category: candidate.category as any,
      depth_level: 'L3',
      title: parsed.title || `品牌级 ${candidate.category} 洞察`,
      content: {
        description: parsed.description,
        affected_store_count: parsed.affected_store_count,
        commonality: parsed.commonality,
        hypothesis: parsed.hypothesis,
        causal_chain: parsed.causal_chain,
        distilled_from: candidate.entries.map((e) => e.id),
      },
      confidence: parsed.confidence || 0.7,
      source_type: 'distilled',
      source_data: {
        distilled_from: candidate.entries.map((e) => e.id),
        distillation_type: 'horizontal',
        depth_transition: 'L2→L3',
        model: 'gemini-2.5-flash',
        source_restaurants: candidate.restaurants,
      },
    });

    await this.knowledgeService.logLearningEvent({
      signal_id: `distill-horizontal-${candidate.category}`,
      action: 'horizontal_distillation_L3',
      input_summary: `Distilled ${candidate.entries.length} L2 patterns from ${candidate.restaurants.length} restaurants → L3 in ${candidate.category}`,
      output_knowledge_ids: newEntry ? [newEntry.id] : [],
      status: 'completed',
    });

    // Auto-trigger L4 action guidance from this new L3 insight
    if (newEntry) {
      try {
        await this.distillActionGuidance(newEntry);
        this.logger.log(`Auto-triggered L4 from new L3 insight: ${newEntry.id}`);
      } catch (e) {
        this.logger.warn(`L4 auto-trigger failed for L3 ${newEntry.id}`, e);
      }
    }

    return true;
  }

  // ─── L4 Action Guidance Distillation (L3→L4, Gemini Flash) ──────

  /**
   * Distills an L3 insight into L4 actionable guidance.
   * Produces a pending_review entry with target_role and action_steps.
   */
  private async distillActionGuidance(
    insight: KnowledgeEntry,
  ): Promise<boolean> {
    const prompt = `你是餐饮行业运营顾问。以下是一条深度洞察(L3)，请从中推导出可执行的最佳实践或改善机会(L4)。

洞察：
标题：${insight.title}
内容：${JSON.stringify(insight.content, null, 2)}
类别：${insight.category}
置信度：${insight.confidence}

请输出JSON格式（只输出JSON，无其他内容）：
{
  "title": "行动指引标题（简洁明确，如'回头客带友推荐策略'）",
  "description": "行动指引描述（100字以内）",
  "target_role": "适用角色：store_manager | operations_director | head_chef",
  "action_steps": [
    {"step": "具体步骤1", "priority": "high/medium/low"},
    {"step": "具体步骤2", "priority": "high/medium/low"}
  ],
  "expected_impact": "预期效果（如'提升回头客带友转化率10-15%'）",
  "applicable_scenario": "适用场景描述",
  "confidence": 0.4到0.8之间的数值（行动建议天然不确定性更高）
}`;

    const result = await this.callGeminiFlash(prompt);
    if (!result) return false;

    const parsed = this.parseJSON(result);
    if (!parsed) return false;

    await this.knowledgeService.createKnowledge({
      brand_id: insight.brand_id,
      restaurant_id: insight.restaurant_id,
      scope: insight.scope,
      knowledge_type: 'best_practice',
      category: (parsed.target_role === 'head_chef' ? 'dish' : 'operation') as any,
      depth_level: 'L4',
      title: parsed.title || `${insight.category} 行动指引`,
      content: {
        description: parsed.description,
        target_role: parsed.target_role,
        action_steps: parsed.action_steps,
        expected_impact: parsed.expected_impact,
        applicable_scenario: parsed.applicable_scenario,
        source_insight_id: insight.id,
        source_insight_title: insight.title,
      },
      confidence: parsed.confidence || 0.5,
      source_type: 'distilled',
      source_data: {
        distilled_from: [insight.id],
        distillation_type: 'action_guidance',
        depth_transition: 'L3→L4',
        model: 'gemini-2.5-flash',
      },
    });

    await this.knowledgeService.logLearningEvent({
      signal_id: `distill-action-${insight.id}`,
      action: 'action_distillation_L4',
      input_summary: `Distilled L3 insight "${insight.title}" → L4 action guidance`,
      output_knowledge_ids: [],
      status: 'completed',
    });

    return true;
  }

  // ─── Exploratory Distillation (Gemini Flash) ────────────────────

  /**
   * Scans L2+ knowledge for unexpected cross-domain correlations.
   * Produces 'emergent' category entries for human review.
   */
  async runExploratoryDistillation(): Promise<{ discovered: number }> {
    const entries =
      await this.knowledgeService.getKnowledgeForExploration(200);

    if (entries.length < 10) {
      this.logger.log(
        `Only ${entries.length} entries for exploration, skipping (need 10+)`,
      );
      return { discovered: 0 };
    }

    let discovered = 0;
    const batchSize = 40;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      try {
        const count = await this.exploreKnowledgeBatch(batch);
        discovered += count;
      } catch (e) {
        this.logger.error(`Exploratory batch ${i}/${entries.length} failed`, e);
      }
    }

    if (discovered > 0) {
      await this.sendBark(
        '🔍 探索性发现',
        `发现 ${discovered} 条跨领域关联\n请在管理面板审核`,
      );
    }

    this.logger.log(`Exploratory distillation complete: ${discovered} discoveries`);
    return { discovered };
  }

  private async exploreKnowledgeBatch(
    batch: KnowledgeEntry[],
  ): Promise<number> {
    const entrySummaries = batch
      .map((e) => {
        const scope = e.restaurant_id
          ? `门店${e.restaurant_id.slice(0, 8)}`
          : e.brand_id
            ? `品牌${e.brand_id}`
            : '全局';
        return `[${scope}][${e.category}][${e.depth_level}] ${e.title}: ${JSON.stringify(e.content)}`;
      })
      .join('\n');

    const prompt = `你是一位具有敏锐洞察力的餐饮行业分析师。以下是 ${batch.length} 条已知知识（涵盖不同门店、不同类别、不同深度层级）。

请仔细阅读，找出其中**未被明确分类的跨领域关联、意外的相关性、或隐藏的因果关系**。

已知知识：
${entrySummaries}

要求：
1. 不要重复已有知识，只找出知识之间的"意外连接"
2. 每个发现必须有至少2条支撑证据（引用具体知识）
3. 关注跨类别的关联（如：菜品评价与服务评价之间的隐藏关系）
4. 如果没有有价值的发现，输出空数组 []

请输出JSON格式（只输出JSON，无其他内容）：
[
  {
    "discovery": "发现描述（一句话概括跨领域关联）",
    "supporting_data": ["支撑证据1（引用具体知识标题或内容）", "支撑证据2"],
    "possible_explanation": "可能的解释或假说",
    "significance": "high/medium/low",
    "suggested_action": "建议的后续验证或行动"
  }
]`;

    const result = await this.callGeminiFlash(prompt);
    if (!result) return 0;

    const discoveries = this.parseJSON(result);
    if (!Array.isArray(discoveries) || !discoveries.length) return 0;

    let count = 0;
    for (const d of discoveries) {
      if (!d.discovery || !d.supporting_data?.length) continue;

      const confidence =
        d.significance === 'high' ? 0.6 : d.significance === 'medium' ? 0.5 : 0.4;

      await this.knowledgeService.createKnowledge({
        scope: 'global',
        knowledge_type: 'pattern',
        category: 'emergent',
        depth_level: 'L2',
        title: d.discovery,
        content: {
          discovery: d.discovery,
          supporting_data: d.supporting_data,
          possible_explanation: d.possible_explanation,
          significance: d.significance,
          suggested_action: d.suggested_action,
          exploration_batch_size: batch.length,
        },
        confidence,
        source_type: 'distilled',
        source_data: {
          distillation_type: 'exploratory',
          model: 'gemini-2.5-flash',
          source_ids: batch.map((e) => e.id),
        },
        auto_approve: false,
      });

      count++;
    }

    if (count > 0) {
      await this.knowledgeService.logLearningEvent({
        signal_id: `distill-explore-${Date.now()}`,
        action: 'exploratory_distillation',
        input_summary: `Explored ${batch.length} entries, discovered ${count} cross-domain patterns`,
        output_knowledge_ids: [],
        status: 'completed',
      });
    }

    return count;
  }

  // ─── Content Regeneration (for revisions) ─────────────────────────

  private async regenerateContent(
    entry: KnowledgeEntry,
  ): Promise<Record<string, unknown> | null> {
    const prompt = `你是餐饮行业知识管理专家。以下是一条AI自动生成的知识，审核人要求修改。请根据审核意见重新生成知识内容。

原始知识：
类型: ${entry.knowledge_type}
标题: ${entry.title}
内容: ${JSON.stringify(entry.content, null, 2)}

审核意见：
${entry.reviewer_note}

请根据审核意见修改知识内容，输出修改后的JSON内容（只输出JSON，无其他内容）。保持原有的JSON结构，只修正审核人指出的问题。`;

    const result = await this.callDeepSeek(prompt);
    if (!result) return null;

    return this.parseJSON(result);
  }

  // ─── AI Helpers ─────────────────────────────────────────────────

  /**
   * Calls DeepSeek V3-0324 via OpenRouter.
   * Used for: vertical distillation (L1→L2), revision regeneration.
   */
  private async callDeepSeek(prompt: string): Promise<string | null> {
    return this.callModel('deepseek/deepseek-chat-v3-0324', prompt, {
      temperature: 0.3,
      max_tokens: 2000,
    });
  }

  /**
   * Calls Gemini 2.5 Flash via OpenRouter with thinking enabled.
   * Used for: horizontal distillation (L2→L3), L4 action guidance, exploratory discovery.
   */
  private async callGeminiFlash(prompt: string): Promise<string | null> {
    return this.callModel('google/gemini-2.5-flash', prompt, {
      temperature: 0.5,
      max_tokens: 4000,
    });
  }

  private async callModel(
    model: string,
    prompt: string,
    options: { temperature: number; max_tokens: number },
  ): Promise<string | null> {
    if (!OPENROUTER_API_KEY) {
      this.logger.warn('OpenRouter API key not configured, skipping AI call');
      return null;
    }

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: options.temperature,
          max_tokens: options.max_tokens,
        }),
      });

      if (!response.ok) {
        this.logger.error(
          `AI call failed [${model}]: ${response.status}`,
        );
        return null;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (e) {
      this.logger.error(`AI call error [${model}]`, e);
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseJSON(text: string): any | null {
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
      return JSON.parse(jsonStr);
    } catch {
      this.logger.warn('Failed to parse AI response as JSON');
      return null;
    }
  }

  // ─── Bark Notification ────────────────────────────────────────────

  /**
   * Weekly chat pattern analysis — discover knowledge gaps from user questions.
   * Runs at 07:00 UTC every Monday (15:00 CST).
   */
  @Cron('0 7 * * 1')
  async analyzeChatPatterns() {
    this.logger.log('Running weekly chat pattern analysis...');
    try {
      const client = this.supabase.getClient();
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      // Get user messages from past week, grouped by restaurant
      const { data: messages } = await client
        .from('lingtin_chat_history')
        .select('restaurant_id, content, created_at')
        .eq('role', 'user')
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: true });

      if (!messages?.length) {
        this.logger.log('No chat messages to analyze');
        return;
      }

      // Group by restaurant, only analyze restaurants with 5+ messages
      const byRestaurant = new Map<string, string[]>();
      for (const m of messages) {
        const rid = m.restaurant_id || 'unknown';
        if (!byRestaurant.has(rid)) byRestaurant.set(rid, []);
        byRestaurant.get(rid)!.push(m.content);
      }

      let gapsCreated = 0;

      for (const [restaurantId, msgs] of byRestaurant) {
        if (msgs.length < 5) continue;

        // Use Gemini Flash to identify repeated question themes
        const sampleMsgs = msgs.slice(0, 50).map((m, i) => `${i + 1}. ${m}`).join('\n');
        const prompt = `你是餐饮SaaS产品分析师。以下是某门店店长/管理者在智库对话中提出的问题（最近一周）。

请归纳出反复出现的问题主题，这些主题代表系统知识库的缺口——用户需要但系统目前没有主动提供的信息。

用户问题：
${sampleMsgs}

要求：
1. 只提取被反复问到的主题（2+次相似问题）
2. 忽略一次性问题和闲聊
3. 如果没有重复主题，输出空数组 []

输出JSON格式（只输出JSON）：
[
  {
    "theme": "主题名称（如'菜品备货量'）",
    "frequency": 出现次数,
    "example_questions": ["代表性问题1", "代表性问题2"],
    "gap_description": "知识缺口描述：系统应该主动提供什么信息来减少这类咨询"
  }
]`;

        const result = await this.callGeminiFlash(prompt);
        if (!result) continue;

        const gaps = this.parseJSON(result);
        if (!Array.isArray(gaps) || !gaps.length) continue;

        for (const gap of gaps) {
          if (!gap.theme || gap.frequency < 2) continue;

          await this.knowledgeService.createKnowledge({
            restaurant_id: restaurantId === 'unknown' ? null : restaurantId,
            scope: restaurantId === 'unknown' ? 'global' : 'restaurant',
            knowledge_type: 'pattern',
            category: 'operation',
            depth_level: 'L1',
            title: `知识缺口: 店长频繁询问「${gap.theme}」相关问题`,
            content: {
              theme: gap.theme,
              frequency: gap.frequency,
              example_questions: gap.example_questions,
              gap_description: gap.gap_description,
              analysis_period: `${weekAgo.split('T')[0]} ~ ${new Date().toISOString().split('T')[0]}`,
              total_messages: msgs.length,
            },
            source_type: 'auto',
            source_signal: 'chat_analysis',
            auto_approve: false,
          });
          gapsCreated++;
        }
      }

      this.logger.log(`Chat analysis complete: ${gapsCreated} knowledge gaps identified`);

      if (gapsCreated > 0) {
        await this.sendBark(
          '🔍 对话分析完成',
          `发现 ${gapsCreated} 条知识缺口，请审核`,
        );
      }
    } catch (e) {
      this.logger.error('analyzeChatPatterns failed', e);
    }
  }

  /**
   * Weekly user behavior analysis.
   * Analyzes activity logs + visit patterns to extract management signals.
   * Runs at 07:30 UTC every Monday (15:30 CST).
   */
  @Cron('30 7 * * 1')
  async analyzeUserBehavior() {
    this.logger.log('Running weekly behavior analysis...');
    try {
      const client = this.supabase.getClient();
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      // 1. Get activity logs grouped by user (capped at 10000 for safety)
      const { data: activities } = await client
        .from('lingtin_user_activity_log')
        .select('user_id, role_code, action_type, method, path, created_at')
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: true })
        .limit(10000);

      if (!activities?.length) {
        this.logger.log('No activity logs found for the past week');
        return;
      }

      // Group by user
      const userMap = new Map<string, typeof activities>();
      for (const a of activities) {
        const key = a.user_id || 'unknown';
        if (!userMap.has(key)) userMap.set(key, []);
        userMap.get(key)!.push(a);
      }

      // 2. Get visit records for the week (core signal, capped at 10000)
      const { data: visits } = await client
        .from('lingtin_visit_records')
        .select('restaurant_id, table_id, created_at, duration, visit_period')
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: true })
        .limit(10000);

      // Group visits by restaurant
      const visitsByRestaurant = new Map<string, Array<{ restaurant_id: string; table_id: string; created_at: string; duration: number | null; visit_period: string | null }>>();
      for (const v of (visits || [])) {
        const rid = v.restaurant_id;
        if (!visitsByRestaurant.has(rid)) visitsByRestaurant.set(rid, []);
        visitsByRestaurant.get(rid)!.push(v);
      }

      // 3. Compute per-restaurant visit metrics
      let metricsWritten = 0;
      const today = new Date().toISOString().split('T')[0];

      for (const [restaurantId, rVisits] of visitsByRestaurant) {
        const uniqueTables = new Set(rVisits.map(v => v.table_id).filter(Boolean));
        const durations = rVisits.map(v => v.duration).filter((d): d is number => typeof d === 'number');
        const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

        // Visit period distribution
        const periodDist: Record<string, number> = {};
        for (const v of rVisits) {
          const period = v.visit_period || 'unknown';
          periodDist[period] = (periodDist[period] || 0) + 1;
        }

        // Visit intervals (time between consecutive recordings)
        const timestamps = rVisits.map(v => new Date(v.created_at).getTime()).sort();
        const intervals: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
          intervals.push((timestamps[i] - timestamps[i - 1]) / 60000); // in minutes
        }
        const avgInterval = intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;

        await this.knowledgeService.recordMetric({
          metric_date: today,
          restaurant_id: restaurantId,
          metric_type: 'weekly_visit_behavior',
          metric_value: {
            total_visits: rVisits.length,
            unique_tables: uniqueTables.size,
            avg_duration_seconds: Math.round(avgDuration),
            avg_interval_minutes: Math.round(avgInterval),
            period_distribution: periodDist,
            daily_avg: Math.round(rVisits.length / 7 * 10) / 10,
          },
        });
        metricsWritten++;
      }

      // 4. Compute per-user feature usage distribution
      for (const [userId, acts] of userMap) {
        const role = acts[0]?.role_code || 'unknown';
        const featureDist: Record<string, number> = {};
        for (const a of acts) {
          // Classify by path
          const path = a.path || '';
          let feature = 'other';
          if (path.includes('/audio') || path.includes('/recorder')) feature = 'recording';
          else if (path.includes('/daily-summary') || path.includes('/dashboard')) feature = 'briefing';
          else if (path.includes('/chat')) feature = 'chat';
          else if (path.includes('/action-items')) feature = 'action_items';
          else if (path.includes('/meeting')) feature = 'meeting';
          featureDist[feature] = (featureDist[feature] || 0) + 1;
        }

        await this.knowledgeService.recordMetric({
          metric_date: today,
          metric_type: 'weekly_user_behavior',
          metric_value: {
            user_id: userId,
            role_code: role,
            total_actions: acts.length,
            feature_distribution: featureDist,
          },
        });
      }

      // 5. Management signal: feature usage rate
      const allPaths = activities.map(a => a.path || '');
      const featureUsed = {
        recording: allPaths.some(p => p.includes('/audio')),
        briefing: allPaths.some(p => p.includes('/daily-summary') || p.includes('/dashboard')),
        chat: allPaths.some(p => p.includes('/chat')),
        action_items: allPaths.some(p => p.includes('/action-items')),
        meeting: allPaths.some(p => p.includes('/meeting')),
      };

      const unusedFeatures = Object.entries(featureUsed)
        .filter(([, used]) => !used)
        .map(([name]) => name);

      if (unusedFeatures.length > 0) {
        await this.knowledgeService.createKnowledge({
          scope: 'global',
          knowledge_type: 'pattern',
          category: 'operation',
          depth_level: 'L1',
          title: `产品信号: ${unusedFeatures.join('/')} 功能本周无人使用`,
          content: {
            unused_features: unusedFeatures,
            active_users: userMap.size,
            total_actions: activities.length,
            week_ending: today,
          },
          source_type: 'auto',
          source_signal: 'behavior_analysis',
          auto_approve: false,
        });
      }

      this.logger.log(`Behavior analysis complete: ${metricsWritten} restaurant metrics, ${userMap.size} user profiles`);

      await this.sendBark(
        '📊 周度行为分析',
        `${userMap.size} 人活跃，${metricsWritten} 店桌访数据\n${unusedFeatures.length > 0 ? `未使用功能: ${unusedFeatures.join(', ')}` : '全部功能已使用'}`,
      );
    } catch (e) {
      this.logger.error('analyzeUserBehavior failed', e);
    }
  }

  private async sendBark(
    title: string,
    body: string,
    sound: 'alert' | 'alarm' = 'alert',
  ): Promise<void> {
    if (!BARK_DEVICE_KEY) {
      this.logger.debug('Bark device key not configured, skipping push');
      return;
    }

    const url =
      `https://api.day.app/${BARK_DEVICE_KEY}` +
      `/${encodeURIComponent(title)}` +
      `/${encodeURIComponent(body)}` +
      `?group=lingtin-knowledge&sound=${sound}&level=timeSensitive`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        this.logger.error(`Bark push failed: ${resp.status}`);
      }
    } catch (err) {
      this.logger.error('Bark push error:', err);
    }
  }
}
