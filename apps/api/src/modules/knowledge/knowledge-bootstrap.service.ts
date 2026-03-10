import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { KnowledgeService } from './knowledge.service';

const OPENROUTER_API_KEY_ENV = () => process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'deepseek/deepseek-chat-v3-0324';
const SAMPLE_SIZE = 50;

interface BootstrapProgress {
  step: string;
  restaurant?: string;
  processed: number;
  total: number;
  rulesExtracted: number;
  errors: string[];
}

@Injectable()
export class KnowledgeBootstrapService {
  private readonly logger = new Logger(KnowledgeBootstrapService.name);
  private running = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  /**
   * Full bootstrap pipeline:
   * 1. Sample transcripts per restaurant → extract STT/dialect rules
   * 2. Sample feedbacks per restaurant → extract labeling rules
   * 3. Extract restaurant profiles + patterns
   * 4. Trigger distillation (via caller)
   */
  async bootstrapAll(): Promise<{
    restaurants: number;
    rulesCreated: number;
    profilesCreated: number;
    errors: string[];
  }> {
    if (this.running) {
      return { restaurants: 0, rulesCreated: 0, profilesCreated: 0, errors: ['Bootstrap already running'] };
    }

    this.running = true;
    let rulesCreated = 0;
    let profilesCreated = 0;
    const errors: string[] = [];

    try {
      // Get all restaurants with data
      const restaurants = await this.getRestaurantsWithData();
      this.logger.log(`Bootstrap: ${restaurants.length} restaurants found`);

      for (const r of restaurants) {
        this.logger.log(`── Restaurant: ${r.restaurant_name} (${r.restaurant_id})`);

        // Step 1: Proofread sample transcripts → extract STT rules
        try {
          const sttRules = await this.proofreadTranscripts(r.restaurant_id, r.restaurant_name);
          rulesCreated += sttRules;
          this.logger.log(`   STT rules extracted: ${sttRules}`);
        } catch (e) {
          const msg = `STT proofreading failed for ${r.restaurant_name}: ${e}`;
          this.logger.error(msg);
          errors.push(msg);
        }

        // Step 2: Review sample feedbacks → extract labeling rules
        try {
          const labelRules = await this.reviewFeedbackLabels(r.restaurant_id, r.restaurant_name);
          rulesCreated += labelRules;
          this.logger.log(`   Label rules extracted: ${labelRules}`);
        } catch (e) {
          const msg = `Feedback review failed for ${r.restaurant_name}: ${e}`;
          this.logger.error(msg);
          errors.push(msg);
        }

        // Step 3: Extract restaurant profile + patterns
        try {
          const profiles = await this.extractRestaurantProfile(r.restaurant_id, r.restaurant_name);
          profilesCreated += profiles;
          this.logger.log(`   Profiles/patterns created: ${profiles}`);
        } catch (e) {
          const msg = `Profile extraction failed for ${r.restaurant_name}: ${e}`;
          this.logger.error(msg);
          errors.push(msg);
        }

        // Small delay between restaurants to avoid rate limits
        await this.delay(2000);
      }

      this.logger.log(`Bootstrap complete: ${rulesCreated} rules, ${profilesCreated} profiles, ${errors.length} errors`);
      return { restaurants: restaurants.length, rulesCreated, profilesCreated, errors };
    } finally {
      this.running = false;
    }
  }

  // ─── Step 1: Transcript Proofreading ──────────────────────────────

  private async proofreadTranscripts(
    restaurantId: string,
    restaurantName: string,
  ): Promise<number> {
    const client = this.supabase.getClient();

    // Sample records with transcripts
    const { data: samples, error } = await client
      .from('lingtin_visit_records')
      .select('id, raw_transcript, corrected_transcript')
      .eq('restaurant_id', restaurantId)
      .not('raw_transcript', 'is', null)
      .order('created_at', { ascending: false })
      .limit(SAMPLE_SIZE);

    if (error || !samples?.length) return 0;

    // Batch transcripts for AI analysis (groups of 10)
    const batches = this.chunk(samples, 10);
    const allRules: Array<{ error_pattern: string; correction: string; context: string }> = [];

    for (const batch of batches) {
      const transcriptTexts = batch
        .map((s, i) => `[${i + 1}] ${(s.raw_transcript || '').slice(0, 300)}`)
        .join('\n\n');

      const prompt = `你是餐饮语音转录的质量审核员。以下是${restaurantName}的${batch.length}条桌访录音转录文本。

请仔细检查每条转录，找出以下问题：
1. **STT 同音字错误**（如"碗豆尖"应为"豌豆尖"，"回锅肉"误转为"汇锅肉"）
2. **方言/口语的误识别**（如成都话"还可以"="不错"是正面，不是中性）
3. **断句错误**（影响语义理解的错误断句）
4. **菜品名称错误**（结合餐饮语境判断）

**防假性规律要求（严格遵守）**：
- 只报告在本批数据中**至少出现 2 次**的模式，单次偶发不算规律
- 每条规律必须标注 "occurrences" 字段，说明在几条转录中观察到
- 不要推测或编造数据中没有的模式
- 如果不确定，宁可不报也不要误报

输出格式（JSON 数组）：
[
  {"error_pattern": "碗豆尖", "correction": "豌豆尖", "context": "STT同音字，在3条转录中出现", "occurrences": 3},
  {"error_pattern": "还可以→neutral", "correction": "还可以→positive", "context": "成都方言中'还可以'表示满意", "occurrences": 5}
]

如果没有发现系统性问题，输出空数组 []。

转录文本：
${transcriptTexts}`;

      try {
        const rules = await this.callAI<Array<{ error_pattern: string; correction: string; context: string }>>(prompt);
        if (Array.isArray(rules)) {
          allRules.push(...rules);
        }
      } catch (e) {
        this.logger.warn(`Proofreading batch failed: ${e}`);
      }

      await this.delay(1000);
    }

    // Deduplicate rules and write to knowledge store
    const uniqueRules = this.deduplicateRules(allRules);
    let created = 0;

    for (const rule of uniqueRules) {
      const result = await this.knowledgeService.createKnowledge({
        restaurant_id: restaurantId,
        scope: 'restaurant',
        knowledge_type: 'rule',
        category: 'general',
        depth_level: 'L1',
        title: `STT纠错: ${rule.error_pattern} → ${rule.correction}`,
        content: {
          error_pattern: rule.error_pattern,
          correction: rule.correction,
          context: rule.context,
          rule_type: 'stt_correction',
        },
        quality_score: 0.7,
        confidence: 0.8,
        source_type: 'auto',
        source_signal: 'bootstrap_proofread',
        auto_approve: true,
      });
      if (result.data) created++;
    }

    return created;
  }

  // ─── Step 2: Feedback Label Review ────────────────────────────────

  private async reviewFeedbackLabels(
    restaurantId: string,
    restaurantName: string,
  ): Promise<number> {
    const client = this.supabase.getClient();

    // Get records with feedbacks
    const { data: samples, error } = await client
      .from('lingtin_visit_records')
      .select('id, feedbacks, raw_transcript')
      .eq('restaurant_id', restaurantId)
      .not('feedbacks', 'is', null)
      .order('created_at', { ascending: false })
      .limit(SAMPLE_SIZE);

    if (error || !samples?.length) return 0;

    // Filter to records with actual feedback arrays
    const withFeedbacks = samples.filter(
      s => Array.isArray(s.feedbacks) && s.feedbacks.length > 0,
    );
    if (!withFeedbacks.length) return 0;

    // Batch for AI review (groups of 10)
    const batches = this.chunk(withFeedbacks, 10);
    const allRules: Array<{ pattern: string; issue: string; correction: string }> = [];

    for (const batch of batches) {
      const feedbackTexts = batch
        .map((s, i) => {
          const fbs = (s.feedbacks as Array<{ text: string; sentiment: string; score: number }>)
            .map(f => `  "${f.text}" → ${f.sentiment}(${f.score})`)
            .join('\n');
          const transcript = (s.raw_transcript || '').slice(0, 200);
          return `[${i + 1}] 原文片段: ${transcript}\n  当前打标:\n${fbs}`;
        })
        .join('\n\n');

      const prompt = `你是餐饮顾客反馈分析的审核员。以下是${restaurantName}的${batch.length}条录音的打标结果，请对照原文审核。

请检查：
1. **情感分类是否准确**（positive/negative/neutral/suggestion）
2. **分数是否与文本匹配**（正面>60, 负面<40, 中性40-60, 建议~50）
3. **是否遗漏了重要反馈点**
4. **方言/口语导致的系统性误判**（如某个表达在当地方言中含义不同）

**防假性规律要求（严格遵守）**：
- 只报告在本批数据中**至少出现 2 次**的系统性偏差，个别误差不算
- 每条规律必须标注 "occurrences" 字段
- 不要推测数据中没有直接证据的模式
- 如果不确定某个表达的方言含义，标注 "confidence": "low"

输出格式（JSON 数组）：
[
  {"pattern": "'还可以'被标为neutral", "issue": "在成都方言中'还可以'偏正面", "correction": "应标为positive，分数65-70", "occurrences": 4, "confidence": "high"},
  {"pattern": "建议类反馈分数偏低", "issue": "'能不能大一点'被打30分", "correction": "suggestion类建议分数应在45-55", "occurrences": 3, "confidence": "medium"}
]

如果没有系统性问题，输出空数组 []。

打标数据：
${feedbackTexts}`;

      try {
        const rules = await this.callAI<Array<{ pattern: string; issue: string; correction: string }>>(prompt);
        if (Array.isArray(rules)) {
          allRules.push(...rules);
        }
      } catch (e) {
        this.logger.warn(`Feedback review batch failed: ${e}`);
      }

      await this.delay(1000);
    }

    // Deduplicate and write rules
    const seen = new Set<string>();
    let created = 0;

    for (const rule of allRules) {
      const key = rule.pattern.toLowerCase();
      if (seen.has(key)) continue;
      // Skip low-confidence rules
      if ((rule as { confidence?: string }).confidence === 'low') continue;
      seen.add(key);

      const result = await this.knowledgeService.createKnowledge({
        restaurant_id: restaurantId,
        scope: 'restaurant',
        knowledge_type: 'rule',
        category: 'general',
        depth_level: 'L1',
        title: `打标纠错: ${rule.pattern}`,
        content: {
          pattern: rule.pattern,
          issue: rule.issue,
          correction: rule.correction,
          rule_type: 'label_correction',
        },
        quality_score: 0.7,
        confidence: 0.75,
        source_type: 'auto',
        source_signal: 'bootstrap_label_review',
        auto_approve: true,
      });
      if (result.data) created++;
    }

    return created;
  }

  // ─── Step 3: Restaurant Profile + Pattern Extraction ──────────────

  private async extractRestaurantProfile(
    restaurantId: string,
    restaurantName: string,
  ): Promise<number> {
    const client = this.supabase.getClient();

    // Aggregate stats
    const { data: stats } = await client
      .from('lingtin_visit_records')
      .select('feedbacks, visit_frequency, sentiment_score, customer_source')
      .eq('restaurant_id', restaurantId)
      .not('feedbacks', 'is', null);

    if (!stats?.length) return 0;

    // Calculate statistics
    const totalRecords = stats.length;
    const withFeedbacks = stats.filter(
      s => Array.isArray(s.feedbacks) && s.feedbacks.length > 0,
    );

    // Sentiment distribution
    const sentiments = { positive: 0, negative: 0, neutral: 0, suggestion: 0 };
    const allFeedbackTexts: string[] = [];

    for (const record of withFeedbacks) {
      for (const fb of record.feedbacks as Array<{ text: string; sentiment: string; score: number }>) {
        sentiments[fb.sentiment as keyof typeof sentiments] =
          (sentiments[fb.sentiment as keyof typeof sentiments] || 0) + 1;
        allFeedbackTexts.push(`${fb.text}(${fb.sentiment})`);
      }
    }

    // Visit frequency
    const freqDist: Record<string, number> = {};
    for (const s of stats) {
      if (s.visit_frequency) {
        freqDist[s.visit_frequency] = (freqDist[s.visit_frequency] || 0) + 1;
      }
    }

    // Average sentiment
    const avgSentiment = stats.reduce((sum, s) => sum + (Number(s.sentiment_score) || 60), 0) / totalRecords;

    // Customer source distribution
    const sourceDist: Record<string, number> = {};
    for (const s of stats) {
      if (s.customer_source) {
        sourceDist[s.customer_source] = (sourceDist[s.customer_source] || 0) + 1;
      }
    }

    // Use AI to extract top patterns from feedback texts
    const sampleTexts = allFeedbackTexts.slice(0, 200).join('\n');

    const prompt = `你是餐饮数据分析师。以下是${restaurantName}的统计数据和反馈样本。

**统计概览：**
- 总录音: ${totalRecords} 条, 有效反馈: ${withFeedbacks.length} 条
- 平均满意度: ${avgSentiment.toFixed(1)} 分
- 情感分布: 正面${sentiments.positive} / 负面${sentiments.negative} / 中性${sentiments.neutral} / 建议${sentiments.suggestion}
- 来访频次: ${JSON.stringify(freqDist)}
- 来源渠道: ${JSON.stringify(sourceDist)}

**反馈样本（前200条）：**
${sampleTexts}

**防假性规律要求**：
- top_complaints 和 top_praises 只列**至少出现 5 次**的问题，标注出现次数
- dish_patterns 只列**至少被提及 3 次**的菜品
- dialect_notes 只列你在样本中**确实多次观察到**的表达，不要推测
- 所有条目需标注出现频次

请输出以下 JSON：
{
  "profile_summary": "一段 100 字以内的门店画像描述（特色、顾客群体、主要问题）",
  "top_complaints": [{"text": "具体问题", "count": 出现次数}],
  "top_praises": [{"text": "具体方面", "count": 出现次数}],
  "dish_patterns": [{"dish": "菜品名", "feedback": "正面/负面趋势描述", "mentions": 提及次数}],
  "service_patterns": [{"text": "规律描述", "count": 出现次数}],
  "dialect_notes": [{"expression": "方言表达", "meaning": "真实含义", "occurrences": 观察次数}]
}`;

    let created = 0;

    try {
      const analysis = await this.callAI<{
        profile_summary: string;
        top_complaints: Array<{ text: string; count: number }> | string[];
        top_praises: Array<{ text: string; count: number }> | string[];
        dish_patterns: Array<{ dish: string; feedback: string; mentions?: number }>;
        service_patterns: Array<{ text: string; count: number }> | string[];
        dialect_notes: Array<{ expression: string; meaning: string; occurrences?: number }> | string[];
      }>(prompt);

      if (!analysis) return 0;

      // Create profile knowledge
      const profileResult = await this.knowledgeService.createKnowledge({
        restaurant_id: restaurantId,
        scope: 'restaurant',
        knowledge_type: 'profile',
        category: 'general',
        depth_level: 'L1',
        title: `${restaurantName} 门店画像`,
        content: {
          summary: analysis.profile_summary,
          stats: {
            total_records: totalRecords,
            feedback_count: withFeedbacks.length,
            avg_sentiment: Math.round(avgSentiment * 10) / 10,
            sentiment_distribution: sentiments,
            visit_frequency: freqDist,
            customer_sources: sourceDist,
          },
          top_complaints: analysis.top_complaints,
          top_praises: analysis.top_praises,
        },
        quality_score: 0.8,
        confidence: 0.85,
        source_type: 'auto',
        source_signal: 'bootstrap_profile',
        auto_approve: true,
      });
      if (profileResult.data) created++;

      // Create dish pattern knowledge
      if (analysis.dish_patterns?.length) {
        const dishResult = await this.knowledgeService.createKnowledge({
          restaurant_id: restaurantId,
          scope: 'restaurant',
          knowledge_type: 'pattern',
          category: 'dish',
          depth_level: 'L1',
          title: `${restaurantName} 菜品反馈模式`,
          content: { patterns: analysis.dish_patterns },
          quality_score: 0.75,
          confidence: 0.8,
          source_type: 'auto',
          source_signal: 'bootstrap_pattern',
          auto_approve: true,
        });
        if (dishResult.data) created++;
      }

      // Create service pattern knowledge
      if (analysis.service_patterns?.length) {
        const serviceResult = await this.knowledgeService.createKnowledge({
          restaurant_id: restaurantId,
          scope: 'restaurant',
          knowledge_type: 'pattern',
          category: 'service',
          depth_level: 'L1',
          title: `${restaurantName} 服务反馈模式`,
          content: { patterns: analysis.service_patterns },
          quality_score: 0.75,
          confidence: 0.8,
          source_type: 'auto',
          source_signal: 'bootstrap_pattern',
          auto_approve: true,
        });
        if (serviceResult.data) created++;
      }

      // Create dialect rules
      if (analysis.dialect_notes?.length) {
        for (const note of analysis.dialect_notes) {
          const noteText = typeof note === 'string' ? note : `${note.expression} = ${note.meaning}`;
          const noteContent = typeof note === 'string'
            ? { dialect_note: note, rule_type: 'dialect' }
            : { expression: note.expression, meaning: note.meaning, occurrences: note.occurrences, rule_type: 'dialect' };
          const dialectResult = await this.knowledgeService.createKnowledge({
            restaurant_id: restaurantId,
            scope: 'restaurant',
            knowledge_type: 'rule',
            category: 'customer',
            depth_level: 'L1',
            title: `方言规则: ${noteText.slice(0, 30)}`,
            content: noteContent,
            quality_score: 0.7,
            confidence: 0.7,
            source_type: 'auto',
            source_signal: 'bootstrap_dialect',
            auto_approve: true,
          });
          if (dialectResult.data) created++;
        }
      }

      // Create benchmark knowledge
      const benchmarkResult = await this.knowledgeService.createKnowledge({
        restaurant_id: restaurantId,
        scope: 'restaurant',
        knowledge_type: 'benchmark',
        category: 'general',
        depth_level: 'L1',
        title: `${restaurantName} 数据基准`,
        content: {
          avg_sentiment: Math.round(avgSentiment * 10) / 10,
          total_records: totalRecords,
          feedback_rate: Math.round((withFeedbacks.length / totalRecords) * 100),
          sentiment_distribution: sentiments,
          positive_rate: Math.round(
            (sentiments.positive / (sentiments.positive + sentiments.negative + sentiments.neutral)) * 100,
          ),
          negative_rate: Math.round(
            (sentiments.negative / (sentiments.positive + sentiments.negative + sentiments.neutral)) * 100,
          ),
        },
        quality_score: 0.9,
        confidence: 0.95,
        source_type: 'auto',
        source_signal: 'bootstrap_benchmark',
        auto_approve: true,
      });
      if (benchmarkResult.data) created++;
    } catch (e) {
      this.logger.error(`Profile extraction AI call failed: ${e}`);
    }

    return created;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private async getRestaurantsWithData(): Promise<
    Array<{ restaurant_id: string; restaurant_name: string; record_count: number }>
  > {
    const client = this.supabase.getClient();
    const { data, error } = await client.rpc('get_restaurants_with_records');

    if (error || !data) {
      // Fallback: query directly
      const { data: records } = await client
        .from('lingtin_visit_records')
        .select('restaurant_id')
        .not('restaurant_id', 'is', null);

      if (!records?.length) return [];

      const countMap = new Map<string, number>();
      for (const r of records) {
        countMap.set(r.restaurant_id, (countMap.get(r.restaurant_id) || 0) + 1);
      }

      // Get restaurant names
      const ids = [...countMap.keys()];
      const { data: restaurants } = await client
        .from('master_restaurant')
        .select('id, restaurant_name')
        .in('id', ids);

      return ids.map(id => ({
        restaurant_id: id,
        restaurant_name: restaurants?.find(r => r.id === id)?.restaurant_name || id,
        record_count: countMap.get(id) || 0,
      }));
    }

    return data;
  }

  private async callAI<T>(prompt: string): Promise<T | null> {
    const apiKey = OPENROUTER_API_KEY_ENV();
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: '你是数据分析助手。只输出 JSON，不要输出其他内容。不要用 markdown code block 包裹。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      this.logger.warn(`Failed to parse AI response: ${cleaned.slice(0, 200)}`);
      return null;
    }
  }

  private deduplicateRules(
    rules: Array<{ error_pattern: string; correction: string; context: string }>,
  ): Array<{ error_pattern: string; correction: string; context: string }> {
    const seen = new Set<string>();
    return rules.filter(r => {
      const key = r.error_pattern.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
