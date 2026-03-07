// Meeting AI Processing Service - STT + AI minutes generation
// v3.0 - Added daily summary context for review meetings + standardized role assignment

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { XunfeiSttService } from '../audio/xunfei-stt.service';
import { DashScopeSttService } from '../audio/dashscope-stt.service';
import { DailySummaryService } from '../daily-summary/daily-summary.service';
import { getChinaDateString } from '../../common/utils/date';
import { SttModel } from '../../common/types/stt';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PRIMARY_MODEL = 'deepseek/deepseek-chat-v3-0324';
const FALLBACK_MODEL = 'qwen/qwen3-235b-a22b';

// 35 minutes timeout for STT (covers 30-min meetings + buffer)
const MEETING_STT_TIMEOUT_MS = 2100000;

const VALID_ROLES = ['manager', 'head_chef', 'front_of_house', 'all'] as const;
type AssignedRole = typeof VALID_ROLES[number];

interface MeetingProcessingResult {
  transcript: string;
  aiSummary: string;
  actionItems: Array<{ who: string; what: string; deadline: string }>;
  keyDecisions: Array<{ decision: string; context: string }>;
}

@Injectable()
export class MeetingAiProcessingService {
  private readonly logger = new Logger(MeetingAiProcessingService.name);
  private processingLocks = new Set<string>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly xunfeiStt: XunfeiSttService,
    private readonly dashScopeStt: DashScopeSttService,
    private readonly dailySummaryService: DailySummaryService,
  ) {}

  async processMeeting(
    recordingId: string,
    audioUrl: string,
    meetingType: string,
    restaurantId: string,
  ): Promise<MeetingProcessingResult> {
    if (this.processingLocks.has(recordingId)) {
      throw new Error('Meeting is already being processed');
    }

    const currentStatus = await this.getStatus(recordingId);
    if (currentStatus === 'processed' || currentStatus === 'processing') {
      throw new Error(`Meeting already ${currentStatus}`);
    }

    this.processingLocks.add(recordingId);

    try {
      await this.updateStatus(recordingId, 'processing');

      const startTime = Date.now();
      this.logger.log(`Pipeline: ${meetingType} 开始处理`);

      // Step 1: STT — DashScope first (with retry for network errors), fallback to 讯飞
      let rawTranscript: string;
      let sttModel: SttModel | undefined;
      if (this.dashScopeStt.isConfigured()) {
        try {
          const sttResult = await this.transcribeWithRetry(audioUrl);
          rawTranscript = sttResult.transcript;
          sttModel = sttResult.sttModel;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`DashScope STT failed, falling back to 讯飞: ${msg}`);
          try {
            const sttResult = await this.xunfeiStt.transcribe(audioUrl, MEETING_STT_TIMEOUT_MS);
            rawTranscript = sttResult.transcript;
            sttModel = sttResult.sttModel;
          } catch (fallbackError) {
            const fbMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
            this.logger.error(`讯飞 STT also failed: ${fbMsg}`);
            throw new Error(`STT双通道失败: DashScope(${msg}), 讯飞(${fbMsg})`);
          }
        }
      } else {
        const sttResult = await this.xunfeiStt.transcribe(audioUrl, MEETING_STT_TIMEOUT_MS);
        rawTranscript = sttResult.transcript;
        sttModel = sttResult.sttModel;
      }
      this.logger.log(`STT完成(${sttModel}): ${rawTranscript.length}字`);

      if (!rawTranscript || rawTranscript.trim().length === 0) {
        this.logger.warn(`空音频或无法识别，跳过AI处理`);
        const emptyResult: MeetingProcessingResult = {
          transcript: '',
          aiSummary: '无法识别语音内容',
          actionItems: [],
          keyDecisions: [],
        };
        await this.saveResults(recordingId, rawTranscript, emptyResult, sttModel);
        return emptyResult;
      }

      // Step 1.5: Light cleaning — deduplicate repeated phrases
      const cleanedTranscript = rawTranscript.replace(/(.{1,6})\1{2,}/g, '$1');
      this.logger.log(`清洗完成: ${rawTranscript.length}字 → ${cleanedTranscript.length}字`);

      // Step 1.6: Fetch daily summary context for daily_review meetings
      let dailySummaryContext = '';
      if (meetingType === 'daily_review') {
        try {
          const today = getChinaDateString();
          const { summary } = await this.dailySummaryService.getDailySummary(restaurantId, today);
          if (summary?.agenda_items && Array.isArray(summary.agenda_items) && summary.agenda_items.length > 0) {
            const lines = summary.agenda_items.map((item: { severity?: string; title?: string; detail?: string; suggestedAction?: string; feedbacks?: Array<{ tableId?: string; text?: string }> }, i: number) => {
              let line = `${i + 1}. [${item.severity || '?'}] ${item.title}: ${item.detail}`;
              if (item.suggestedAction) line += ` → 建议: ${item.suggestedAction}`;
              if (item.feedbacks?.length) {
                const fbTexts = item.feedbacks.map((f: { tableId?: string; text?: string }) => `${f.tableId || '?'}桌:"${f.text || ''}"`).join('; ');
                line += ` (${fbTexts})`;
              }
              return line;
            });
            dailySummaryContext = `【今日桌访数据汇总】\n总桌访数: ${summary.total_visits || '?'}, 平均满意度: ${summary.avg_sentiment ?? '?'}\n${summary.ai_overview || ''}\n\n议题:\n${lines.join('\n')}\n\n---\n`;
            this.logger.log(`已加载今日桌访汇总上下文 (${summary.agenda_items.length}条议题)`);
          } else {
            // Try to generate summary on the fly
            try {
              const generated = await this.dailySummaryService.generateDailySummary(restaurantId, today);
              if (generated?.summary?.agenda_items?.length) {
                const items = generated.summary.agenda_items;
                const lines = items.map((item: { severity?: string; title?: string; detail?: string }, i: number) =>
                  `${i + 1}. [${item.severity || '?'}] ${item.title}: ${item.detail}`);
                dailySummaryContext = `【今日桌访数据汇总】\n总桌访数: ${generated.summary.total_visits || '?'}\n${generated.summary.ai_overview || ''}\n\n议题:\n${lines.join('\n')}\n\n---\n`;
                this.logger.log(`按需生成桌访汇总上下文 (${items.length}条议题)`);
              }
            } catch (genErr) {
              this.logger.warn(`按需生成 daily summary 失败: ${genErr instanceof Error ? genErr.message : String(genErr)}`);
            }
          }
        } catch (err) {
          this.logger.warn(`获取 daily summary 上下文失败: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Step 2: AI minutes generation
      const aiResult = await this.generateMinutes(cleanedTranscript, meetingType, dailySummaryContext);
      this.logger.log(`AI完成: ${aiResult.actionItems.length} action items`);

      // Step 3: Save results
      await this.saveResults(recordingId, rawTranscript, aiResult, sttModel);

      // Step 4: Write action items to lingtin_action_items (for review/pre_meal meetings)
      if (aiResult.actionItems.length > 0) {
        await this.saveActionItems(recordingId, restaurantId, meetingType, aiResult.actionItems);
      }

      const totalTime = Date.now() - startTime;
      this.logger.log(`Pipeline: ${meetingType} 完成 (${(totalTime / 1000).toFixed(1)}s)`);

      return aiResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Pipeline failed for ${recordingId}: ${errorMessage}`);
      await this.saveErrorStatus(recordingId, errorMessage);
      throw error;
    } finally {
      this.processingLocks.delete(recordingId);
    }
  }

  // Retry DashScope STT once for transient network errors (fetch failed, ETIMEDOUT, etc.)
  private async transcribeWithRetry(audioUrl: string): Promise<{ transcript: string; sttModel: SttModel }> {
    try {
      return await this.dashScopeStt.transcribe(audioUrl, 4, 600000);
    } catch (firstError) {
      const msg = firstError instanceof Error ? firstError.message : String(firstError);
      const isTransient = /fetch failed|ETIMEDOUT|ECONNRESET|ENOTFOUND|socket hang up|network/i.test(msg);
      if (!isTransient) throw firstError;

      this.logger.warn(`DashScope STT network error, retrying in 3s: ${msg}`);
      await new Promise(r => setTimeout(r, 3000));
      return await this.dashScopeStt.transcribe(audioUrl, 4, 600000);
    }
  }

  private async generateMinutes(
    transcript: string,
    meetingType: string,
    dailySummaryContext = '',
  ): Promise<MeetingProcessingResult> {
    // Try primary model, fallback to secondary on 402/500/502/503 errors
    try {
      return await this.callAiModel(transcript, meetingType, dailySummaryContext, PRIMARY_MODEL);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isRetryable = /API 错误 (402|500|502|503)|fetch failed|ETIMEDOUT/i.test(msg);
      if (!isRetryable) throw error;

      this.logger.warn(`Primary AI model failed (${msg}), trying fallback: ${FALLBACK_MODEL}`);
      return await this.callAiModel(transcript, meetingType, dailySummaryContext, FALLBACK_MODEL);
    }
  }

  private async callAiModel(
    transcript: string,
    meetingType: string,
    dailySummaryContext: string,
    model: string,
  ): Promise<MeetingProcessingResult> {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      throw new Error('AI_NOT_CONFIGURED: OpenRouter AI 未配置');
    }

    const meetingTypeLabel =
      meetingType === 'pre_meal' ? '餐前会' :
      meetingType === 'daily_review' ? '每日复盘总结会' :
      meetingType === 'weekly' ? '周例会' :
      meetingType === 'kitchen_meeting' ? '厨房会议' :
      meetingType === 'cross_store_review' ? '跨门店经营分析会' :
      meetingType === 'one_on_one' ? '与店长一对一沟通' : '会议';

    const systemPrompt = `你是餐饮门店会议记录助手。分析${meetingTypeLabel}的录音转写文本，生成结构化会议纪要。${dailySummaryContext ? '\n\n请结合今日桌访数据汇总，关注高频问题和与桌访反馈相关的讨论。' : ''}

输出JSON格式（只输出JSON，无其他内容）：
{
  "aiSummary": "150字以内会议摘要，包含主要议题和结论",
  "actionItems": [
    {"who": "manager", "what": "具体待办事项", "deadline": "截止时间，如本周五、明天午市前"}
  ],
  "keyDecisions": [
    {"decision": "决定的内容", "context": "做出决定的原因或背景"}
  ]
}

规则：
1. aiSummary: 概括会议核心内容，包括讨论的主要议题和最终结论，不超过150字
2. actionItems: 提取会议中明确分配的任务
   - who: 必须是以下角色之一：manager（店长）、head_chef（厨师长/后厨）、front_of_house（前厅）、all（全员）。根据任务内容和会议中提到的负责人判断最合适的角色：
     * 涉及菜品质量、出品、食材、备餐 → head_chef
     * 涉及服务、接待、环境、前厅 → front_of_house
     * 涉及管理、排班、成本、数据 → manager
     * 涉及全员执行的通知或要求 → all
   - what: 具体、可执行的描述，如"检查冷库温度记录"而非"注意冷库"
   - deadline: 从原文提取截止时间，如未明确则根据会议类型推断（餐前会→当日，复盘→次日，周例会→本周内）
3. keyDecisions: 提取会议中做出的重要决定
   - 只记录明确达成共识的决定，不记录讨论中的提议
4. 如果某项为空，返回空数组[]
5. 不要编造原文中没有的内容
6. 针对不同会议类型的侧重：
   - 餐前会：关注当日注意事项、推荐菜品、人员分工
   - 每日复盘：关注当日问题总结、表扬亮点、次日安排
   - 周例会：关注本周趋势、数据对比、下周计划
   - 厨房会议：关注出菜质量、备餐安排、食材管理
   - 跨门店经营分析会：重点提取各店问题对比和跨店统一决策
   - 与店长一对一沟通：重点提取问题根因分析和承诺事项`;

    this.logger.log(`AI 调用模型: ${model}`);

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${dailySummaryContext}会议转写文本：\n${transcript}` },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenRouter API error (${model}): ${response.status} - ${errorText}`);
      throw new Error(`AI_API_ERROR: OpenRouter API 错误 ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('AI_EMPTY_RESPONSE: OpenRouter 返回空结果');
    }

    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      this.logger.error(`AI返回无效JSON (${model}): ${cleanContent.substring(0, 200)}`);
      throw new Error('AI_PARSE_ERROR: 无法解析 AI 返回结果');
    }

    let result: { aiSummary?: string; actionItems?: Array<{ who: string; what: string; deadline: string }>; keyDecisions?: Array<{ decision: string; context: string }> };
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      this.logger.error(`AI返回无效JSON (${model}): ${jsonMatch[0].substring(0, 200)}`);
      throw new Error('AI_PARSE_ERROR: 无法解析 AI 返回的JSON');
    }

    return {
      transcript,
      aiSummary: result.aiSummary || '无摘要',
      actionItems: result.actionItems || [],
      keyDecisions: result.keyDecisions || [],
    };
  }

  private async saveActionItems(
    meetingId: string,
    restaurantId: string,
    meetingType: string,
    actionItems: Array<{ who: string; what: string; deadline: string }>,
  ): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const today = getChinaDateString();

      const sourceType = meetingType === 'daily_review' ? 'review_meeting'
        : meetingType === 'pre_meal' ? 'pre_meal_meeting'
        : meetingType === 'cross_store_review' ? 'cross_store_meeting'
        : meetingType === 'one_on_one' ? 'one_on_one_meeting'
        : 'meeting';

      const rows = actionItems.map(item => {
        const role: AssignedRole = VALID_ROLES.includes(item.who as AssignedRole)
          ? (item.who as AssignedRole)
          : 'manager';

        return {
          restaurant_id: restaurantId,
          action_date: today,
          source_type: sourceType,
          category: 'other',
          suggestion_text: item.what,
          priority: 'medium',
          evidence: [],
          visit_ids: [],
          status: 'pending',
          assignee: null,
          assigned_role: role,
          deadline: item.deadline || null,
          meeting_id: meetingId,
        };
      });

      const { error } = await client
        .from('lingtin_action_items')
        .insert(rows);

      if (error) {
        this.logger.error(`Failed to save action items: ${error.message}`);
      } else {
        this.logger.log(`Saved ${rows.length} action items from ${meetingType} meeting`);
      }
    } catch (err) {
      // Non-fatal: don't fail the pipeline if action items insertion fails
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`saveActionItems error (non-fatal): ${msg}`);
    }
  }

  private async getStatus(recordingId: string): Promise<string | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('lingtin_meeting_records')
      .select('status')
      .eq('id', recordingId)
      .single();

    if (error) {
      this.logger.warn(`Failed to get status for ${recordingId}: ${error.message}`);
      return null;
    }
    return data?.status || null;
  }

  private async updateStatus(recordingId: string, status: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('lingtin_meeting_records')
      .update({ status })
      .eq('id', recordingId);

    if (error) {
      this.logger.error(`Failed to update status for ${recordingId}: ${error.message}`);
    }
  }

  private async saveResults(
    recordingId: string,
    rawTranscript: string,
    result: MeetingProcessingResult,
    sttModel?: SttModel,
  ): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('lingtin_meeting_records')
      .update({
        raw_transcript: rawTranscript,
        corrected_transcript: rawTranscript,
        ai_summary: result.aiSummary,
        action_items: result.actionItems,
        key_decisions: result.keyDecisions,
        stt_model: sttModel || null,
        status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    if (error) {
      this.logger.error(`Failed to save meeting results: ${error.message}`);
      throw new Error(`DB_WRITE_ERROR: 保存会议纪要失败 - ${error.message}`);
    }
  }

  private async saveErrorStatus(recordingId: string, errorMessage: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('lingtin_meeting_records')
      .update({
        status: 'error',
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    if (error) {
      this.logger.error(`Failed to save error status for ${recordingId}: ${error.message}`);
    }
  }
}
