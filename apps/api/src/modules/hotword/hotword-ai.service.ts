// Hotword AI Service - Extract hotwords from text using DeepSeek via OpenRouter
// v1.0 - Supports menu mode (dish names) and general mode (entities)

import { Injectable, Logger } from '@nestjs/common';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface ExtractedHotword {
  text: string;
  weight: number;
  category: string;
}

@Injectable()
export class HotwordAiService {
  private readonly logger = new Logger(HotwordAiService.name);

  /**
   * Extract hotwords from text using DeepSeek
   * @param text Input text to extract from
   * @param mode 'menu' for dish name extraction, 'general' for entity extraction
   */
  async extract(text: string, mode: 'menu' | 'general'): Promise<ExtractedHotword[]> {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      throw new Error('AI_NOT_CONFIGURED: OpenRouter API Key 未配置');
    }

    const systemPrompt = mode === 'menu'
      ? `你是餐饮热词提取助手。从菜单文本中提取菜品名称作为语音识别热词。

规则：
1. 提取所有菜品名称（2-10个字）
2. 去重，保留标准菜名
3. 排除价格、数量、分类标题等非菜名内容
4. 每个菜名 weight=3，category="dish_name"

输出JSON数组（只输出JSON，无其他内容）：
[{"text": "菜品名", "weight": 3, "category": "dish_name"}]`
      : `你是餐饮行业热词提取助手。从文本中提取适合语音识别增强的关键实体。

提取规则：
- 品牌名（如巴奴、海底捞）：weight=5，category="brand"
- 菜品名（如毛肚、酥肉）：weight=3-4，category="dish_name"
- 服务术语（如加汤、催菜）：weight=2，category="service_term"
- 每个词 2-10 个字
- 去重，排除通用词汇

输出JSON数组（只输出JSON，无其他内容）：
[{"text": "词语", "weight": 3, "category": "dish_name"}]`;

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
          { role: 'user', content: text },
        ],
        temperature: 0.1,
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
      throw new Error('AI_EMPTY_RESPONSE: AI 返回空结果');
    }

    // Parse JSON from AI response (may be wrapped in ```json blocks)
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const jsonMatch = cleanContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      this.logger.error(`AI返回无效JSON: ${cleanContent.substring(0, 200)}`);
      throw new Error('AI_PARSE_ERROR: 无法解析 AI 返回结果');
    }

    let result: Array<{ text?: string; weight?: number; category?: string }>;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      this.logger.error(`AI返回无效JSON: ${jsonMatch[0].substring(0, 200)}`);
      throw new Error('AI_PARSE_ERROR: 无法解析 AI 返回的JSON');
    }

    if (!Array.isArray(result)) {
      throw new Error('AI_PARSE_ERROR: AI 返回结果不是数组');
    }

    // Validate and normalize each extracted hotword
    const VALID_CATEGORIES = ['dish_name', 'brand', 'service_term', 'other'];
    return result
      .filter((item) => item.text && item.text.length >= 1 && item.text.length <= 10)
      .map((item) => ({
        text: item.text!.trim(),
        weight: Math.max(-6, Math.min(5, item.weight || 3)),
        category: VALID_CATEGORIES.includes(item.category || '') ? item.category! : 'other',
      }));
  }
}
