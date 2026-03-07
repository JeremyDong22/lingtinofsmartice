// Feedback AI Service - Classify employee feedback using DeepSeek via OpenRouter
// v1.1 - Added matchAndReply() for auto-resolve changelog matching

import { Injectable, Logger } from '@nestjs/common';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface ClassificationResult {
  category: string;
  ai_summary: string;
  priority: string;
  tags: string[];
}

interface FeedbackForMatching {
  id: string;
  content_text: string;
  ai_summary: string | null;
  category: string | null;
}

interface MatchResult {
  feedback_id: string;
  reply: string;
}

@Injectable()
export class FeedbackAiService {
  private readonly logger = new Logger(FeedbackAiService.name);

  async classify(text: string): Promise<ClassificationResult> {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      throw new Error('AI_NOT_CONFIGURED: OpenRouter AI 未配置');
    }

    const systemPrompt = `你是餐饮管理系统的反馈分类助手。对员工提交的产品反馈进行分类、摘要和优先级评估。

输出JSON格式（只输出JSON，无其他内容）：
{
  "category": "分类",
  "ai_summary": "30字以内的摘要",
  "priority": "优先级",
  "tags": ["标签1", "标签2"]
}

分类规则 (category)：
- bug: 系统故障、报错、闪退、数据异常
- feature_request: 新功能需求、希望增加的能力
- usability: 操作不便、界面困惑、交互问题
- performance: 速度慢、卡顿、加载时间长
- content: 内容质量（AI分析不准、翻译错误等）
- other: 无法归类的反馈

优先级规则 (priority)：
- high: 影响核心流程无法使用、数据丢失风险
- medium: 影响体验但有替代方案
- low: 锦上添花的建议

tags: 提取2-4个关键词标签

ai_summary: 用一句话概括反馈核心诉求，不超过30字`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3-0324',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `员工反馈内容：\n${text}` },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenRouter API error: ${response.status} - ${errorText}`);
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
      this.logger.error(`AI返回无效JSON: ${cleanContent.substring(0, 200)}`);
      throw new Error('AI_PARSE_ERROR: 无法解析 AI 返回结果');
    }

    let result: { category?: string; ai_summary?: string; priority?: string; tags?: string[] };
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      this.logger.error(`AI返回无效JSON: ${jsonMatch[0].substring(0, 200)}`);
      throw new Error('AI_PARSE_ERROR: 无法解析 AI 返回的JSON');
    }

    const VALID_CATEGORIES = ['bug', 'feature_request', 'usability', 'performance', 'content', 'other'];
    const VALID_PRIORITIES = ['high', 'medium', 'low'];

    return {
      category: VALID_CATEGORIES.includes(result.category || '') ? result.category! : 'other',
      ai_summary: (result.ai_summary || '').substring(0, 50),
      priority: VALID_PRIORITIES.includes(result.priority || '') ? result.priority! : 'medium',
      tags: Array.isArray(result.tags) ? result.tags.slice(0, 5) : [],
    };
  }

  async matchAndReply(
    feedbacks: FeedbackForMatching[],
    changelogText: string,
    version: string,
  ): Promise<MatchResult[]> {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      throw new Error('AI_NOT_CONFIGURED: OpenRouter AI 未配置');
    }

    if (feedbacks.length === 0) return [];

    const feedbackList = feedbacks.map(f => ({
      id: f.id,
      content: f.content_text || f.ai_summary || '',
      category: f.category,
    }));

    const systemPrompt = `你是餐饮管理系统的反馈匹配助手。根据本次版本更新的 CHANGELOG，判断哪些员工反馈被本次更新解决了，并为每条匹配的反馈生成个性化感谢回复。

规则：
1. 只匹配确实被本次更新解决的反馈，不确定就不匹配
2. 回复语气温暖真诚，感谢员工的反馈
3. 回复中说明发现的问题和采取的修复方案，让员工感受到反馈被重视
4. 回复中提及版本号 v${version}
5. 不匹配的反馈不要出现在输出中
6. 每条回复控制在50字以内

输出JSON数组（只输出JSON，无其他内容）：
[
  { "feedback_id": "xxx", "reply": "感谢回复内容" }
]

如果没有匹配的反馈，输出空数组 []`;

    const userContent = `员工反馈列表：
${JSON.stringify(feedbackList, null, 2)}

本次版本 v${version} 更新日志：
${changelogText}`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3-0324',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenRouter API error: ${response.status} - ${errorText}`);
      throw new Error(`AI_API_ERROR: OpenRouter API 错误 ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      this.logger.warn('AI returned empty response for matchAndReply');
      return [];
    }

    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const jsonMatch = cleanContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      this.logger.warn(`AI returned no JSON array for matchAndReply: ${cleanContent.substring(0, 200)}`);
      return [];
    }

    try {
      const results: MatchResult[] = JSON.parse(jsonMatch[0]);
      // Validate: only keep results with valid feedback IDs
      const validIds = new Set(feedbacks.map(f => f.id));
      return results.filter(r => r.feedback_id && r.reply && validIds.has(r.feedback_id));
    } catch {
      this.logger.error(`Failed to parse matchAndReply JSON: ${jsonMatch[0].substring(0, 200)}`);
      return [];
    }
  }
}
