// Chat Service - AI assistant business logic with Claude SDK
// v1.0

import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseService } from '../../common/supabase/supabase.service';

// System prompt for Text-to-SQL and analytics
const SYSTEM_PROMPT = `
你是一个餐饮数据分析助手，名叫 Lingtin AI。你可以帮助餐厅老板分析桌访录音数据。

## 可用数据表

1. **lingtin_visit_records** - 桌访录音记录
   - table_id: 桌号 (如 B4, A12)
   - corrected_transcript: 纠偏后的对话文本
   - visit_type: 访问类型 (routine/complaint/promotion)
   - sentiment_score: 情绪得分 (-1.00 到 1.00)
   - service_stage: 服务环节 (ordering/serving/checkout)
   - ai_summary: AI生成的简要总结
   - visit_date: 日期
   - visit_period: 时段 (lunch/dinner)

2. **lingtin_dish_mentions** - 菜品提及
   - dish_name: 菜品名称
   - sentiment: 评价 (positive/negative/neutral)
   - feedback_text: 具体反馈内容

3. **lingtin_table_sessions** - 开台数据
   - session_date: 日期
   - period: 时段
   - table_id: 桌号
   - guest_count: 就餐人数

## 回答规范

1. 如果问题需要查询数据，先说明你要查询什么
2. 用自然语言总结发现，引用具体的桌号和日期作为证据
3. 如有负面反馈，主动给出改进建议
4. 保持简洁，重点突出

## 当前上下文
- 餐厅ID: {{RESTAURANT_ID}}
- 当前日期: {{CURRENT_DATE}}
`;

@Injectable()
export class ChatService {
  private anthropic: Anthropic;

  constructor(private readonly supabase: SupabaseService) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async streamResponse(
    message: string,
    restaurantId: string,
    sessionId: string | undefined,
    res: Response,
  ) {
    const currentDate = new Date().toISOString().split('T')[0];
    const systemPrompt = SYSTEM_PROMPT.replace('{{RESTAURANT_ID}}', restaurantId).replace(
      '{{CURRENT_DATE}}',
      currentDate,
    );

    try {
      // Stream response from Claude
      const stream = await this.anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          res.write(`data: ${JSON.stringify({ type: 'text', content: event.delta.text })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`,
      );
      res.end();
    }
  }

  async getSessions(restaurantId: string) {
    const client = this.supabase.getClient();

    // This would query from a chat_sessions table if implemented
    // For now, return empty array
    return { sessions: [] };
  }

  // Helper: Execute SQL query for Text-to-SQL feature
  async executeQuery(sql: string) {
    const client = this.supabase.getClient();

    // Only allow SELECT queries for safety
    if (!sql.trim().toLowerCase().startsWith('select')) {
      throw new Error('Only SELECT queries are allowed');
    }

    const { data, error } = await client.rpc('execute_readonly_query', {
      query_text: sql,
    });

    if (error) throw error;
    return data;
  }
}
