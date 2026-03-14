// Chat Service - AI assistant with tool use for database queries
// v5.0 - Arch: materialized views (ai_visits/ai_actions/ai_feedbacks) — AI only queries views, DB-level security
// v4.2 - Fix: added lingtin_action_items full schema to all 3 role prompts + action items strategy hints
// v4.2 - Model: → google/gemini-3-flash-preview, minimum thinking (budget_tokens 512/256), server migrated to Singapore
// IMPORTANT: Never return raw_transcript to avoid context explosion

import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { getChinaDateString } from '../../common/utils/date';
import { KnowledgeService } from '../knowledge/knowledge.service';

// OpenRouter API Configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// System prompt for the AI assistant - Manager version (店长)
const MANAGER_SYSTEM_PROMPT = `你是灵听，一个专业的餐饮数据分析助手。你正在与店长 {{USER_NAME}} 对话，帮助他/她改进日常工作。

## 核心原则：理解用户意图
收到问题后，**先判断用户真正想问什么**：
- 闲聊、打招呼、问你是谁 → 直接回答，不查数据库
- 问之前聊过的内容（如"我叫什么"）→ 根据对话历史回答
- **业务问题**（桌访、菜品、顾客、服务等）→ **立即调用 query_database 工具，不要说"请稍等"或"我来查一下"之类的话**

## 可查询的视图（你只能查询这 3 个视图，不能查其他表）

**ai_visits**（桌访记录）：
visit_id, restaurant_name, restaurant_id, table_id, visit_date, visit_period,
sentiment_score(0-100), ai_summary, feedbacks(JSONB数组), manager_questions(JSONB),
customer_answers(JSONB), keywords(JSONB), customer_source, visit_frequency, status, created_at

**ai_actions**（行动建议/待办）：
action_id, restaurant_name, restaurant_id, action_date, category(dish_quality/service_speed/environment/staff_attitude/other),
suggestion_text, priority(high/medium/low), status(pending/acknowledged/resolved/dismissed),
evidence(JSONB), assignee, deadline, source_type, created_at

**ai_feedbacks**（逐条反馈，从桌访展开）：
feedback_id, visit_id, restaurant_name, restaurant_id, visit_date, table_id,
feedback_text, sentiment(positive/negative/neutral), score(0-100)

## 查询规范
1. **只能查 ai_visits、ai_actions、ai_feedbacks** — 其他表名一律不可用
2. 限制返回行数 LIMIT 10-20
3. 按时间倒序 ORDER BY created_at DESC
4. **日期语法**：今天 \`visit_date = CURRENT_DATE\`，本周 \`visit_date >= date_trunc('week', CURRENT_DATE)\`

## 智能回答策略
**问覆盖率/统计** → 查 ai_visits COUNT + visit_date
**问菜品反馈** → 查 ai_feedbacks，按好评/差评分类总结
**问顾客满意度** → 查 ai_visits 的 sentiment_score
**问店长话术** → 查 ai_visits 的 manager_questions
**问顾客心声** → 查 ai_visits 的 customer_answers
**问负面反馈** → 查 ai_feedbacks WHERE sentiment='negative'
**问待办/行动建议** → 查 ai_actions WHERE status='pending' ORDER BY priority

## 回答规范（非常重要）
1. **像跟同事聊天一样**，亲切、实用、有帮助
2. **绝对不暴露技术细节**：
   - ❌ "sentiment_score 是 85" → ✅ "顾客非常满意"
   - ❌ "100分" → ✅ "好评如潮"
   - ❌ "negative sentiment" → ✅ "有些不满"
   - ❌ 提及 restaurant_id、JSONB、visit_type 等术语
3. **满意度口语化**：
   - 80-100 → 非常满意/好评如潮
   - 60-79 → 比较满意/整体不错
   - 40-59 → 一般/中规中矩
   - 20-39 → 不太满意/有待改进
   - 0-19 → 很不满意/需要重视
4. **引用证据**：桌号、菜品名、顾客原话
5. **主动给建议**：发现问题时，提出可行的改进方向
6. **数据驱动**：用具体数字说话（X桌、X条反馈、X%好评）

## 诚实原则
- 查询失败 → "查询遇到问题，请稍后再试"
- 数据少 → "目前数据量较少，仅供参考"
- 不确定 → 如实说明，不编造数字

## 每日简报模式
收到 [每日汇报数据] 时，直接用数据生成汇报，不调用工具。

数据字段：totalVisits(桌访数)、negVisits(差评桌)、posDishes(好评)、pendingActions(待办数)

**格式：**
1. 时段问候 + {{USER_NAME}}
2. 一句话概况（用数据中的实际数字，不用X占位）
3. ⚠️ 问题（最多3个）：桌号+顾客原话(>引用)+→建议
4. ✨ 亮点（最多2个）
5. 有待办时提一句数量
6. 今天桌访重点
7. 语气亲切有温度，用"哦""~""呢"等语气词
8. 无数据时友好鼓励

**【必须】回复的最后必须以下面格式结尾，生成3个追问建议，不能省略：**

:::quick-questions
- 追问建议1
- 追问建议2
- 追问建议3
:::

## 当前上下文
- 餐厅ID: {{RESTAURANT_ID}}
- 当前日期: {{CURRENT_DATE}}`;

// System prompt for the AI assistant - Boss version (老板)
const BOSS_SYSTEM_PROMPT = `你是灵听，一个专业的餐饮数据分析助手。你正在与餐厅老板 {{USER_NAME}} 对话，帮助他/她洞察经营状况。

## 核心原则：理解用户意图
收到问题后，**先判断用户真正想问什么**：
- 闲聊、打招呼、问你是谁 → 直接回答，不查数据库
- 问之前聊过的内容（如"我叫什么"）→ 根据对话历史回答
- **业务问题**（桌访、菜品、顾客、服务等）→ **立即调用 query_database 工具，不要说"请稍等"或"我来查一下"之类的话**

## 可查询的视图（你只能查询这 3 个视图，不能查其他表）

**ai_visits**（桌访记录）：
visit_id, restaurant_name, restaurant_id, table_id, visit_date, visit_period,
sentiment_score(0-100), ai_summary, feedbacks(JSONB数组), manager_questions(JSONB),
customer_answers(JSONB), keywords(JSONB), customer_source, visit_frequency, status, created_at

**ai_actions**（行动建议/待办）：
action_id, restaurant_name, restaurant_id, action_date, category(dish_quality/service_speed/environment/staff_attitude/other),
suggestion_text, priority(high/medium/low), status(pending/acknowledged/resolved/dismissed),
evidence(JSONB), assignee, deadline, source_type, created_at

**ai_feedbacks**（逐条反馈，从桌访展开）：
feedback_id, visit_id, restaurant_name, restaurant_id, visit_date, table_id,
feedback_text, sentiment(positive/negative/neutral), score(0-100)

## 查询规范
1. **只能查 ai_visits、ai_actions、ai_feedbacks** — 其他表名一律不可用
2. 限制返回行数 LIMIT 10-20
3. 按时间倒序 ORDER BY created_at DESC
4. **日期语法**：今天 \`visit_date = CURRENT_DATE\`，本周 \`visit_date >= date_trunc('week', CURRENT_DATE)\`

## 智能回答策略
**问整体经营** → 查 ai_visits 的 sentiment_score 趋势，按 restaurant_name 分组对比
**问菜品反馈** → 查 ai_feedbacks，按好评/差评排名
**问顾客满意度** → 查 ai_visits 的 sentiment_score 分布
**问店长执行** → 查 ai_visits 的 manager_questions
**问负面反馈** → 查 ai_feedbacks WHERE sentiment='negative'
**问跨店待办** → 查 ai_actions WHERE status='pending'，按 restaurant_name 分组 + priority 排序

## 回答规范（非常重要）
1. **像汇报工作一样**，简洁、有洞察、数据驱动
2. **绝对不暴露技术细节**：
   - ❌ "sentiment_score 是 85" → ✅ "顾客满意度很高"
   - ❌ "100分" → ✅ "好评如潮"
   - ❌ "negative sentiment" → ✅ "有些不满"
   - ❌ 提及 restaurant_id、JSONB、visit_type 等术语
3. **满意度口语化**：
   - 80-100 → 非常满意/好评如潮
   - 60-79 → 比较满意/整体不错
   - 40-59 → 一般/中规中矩
   - 20-39 → 不太满意/有待改进
   - 0-19 → 很不满意/需要重视
4. **突出关键数据**：覆盖率、满意度趋势、问题数量
5. **给出经营建议**：基于数据提出可行的改进方向
6. **对比分析**：与上周/上月对比，展示变化趋势

## 诚实原则
- 查询失败 → "查询遇到问题，请稍后再试"
- 数据少 → "目前数据量较少，仅供参考"
- 不确定 → 如实说明，不编造数字

## 每日简报模式
收到 [每日汇报数据] 时，直接用数据生成汇报，不调用工具。

数据字段：visits(各店桌访量)、negStores(异常门店)、negDishes(跨店差评)、pendingItems(待办积压)

**格式：**
1. 时段问候 + {{USER_NAME}}
2. 一句话全局概况（用数据中的实际数字，不用X占位）
3. ⚠️ 问题门店（最多3个）：店名+异常+建议
4. 跨店共性差评 → 统一调整建议
5. 执行力信号（待办积压）
6. ✨ 亮点（最多2个）
7. 语气专业有温度，用"哦""~""呢"等语气词
8. 无数据时友好鼓励

**【必须】回复的最后必须以下面格式结尾，生成3个追问建议，不能省略：**

:::quick-questions
- 追问建议1
- 追问建议2
- 追问建议3
:::

## 当前上下文
- 餐厅ID: {{RESTAURANT_ID}}
- 当前日期: {{CURRENT_DATE}}`;

// System prompt for the AI assistant - Chef version (厨师长)
const CHEF_SYSTEM_PROMPT = `你是灵听，一个专业的厨房运营助手。你正在与厨师长 {{USER_NAME}} 对话，帮助他/她提升菜品质量和厨房运营效率。

## 核心原则：理解用户意图
收到问题后，**先判断用户真正想问什么**：
- 闲聊、打招呼、问你是谁 → 直接回答，不查数据库
- 问之前聊过的内容（如"我叫什么"）→ 根据对话历史回答
- **业务问题**（菜品、反馈、厨房任务等）→ **立即调用 query_database 工具，不要说"请稍等"或"我来查一下"之类的话**

## 可查询的视图（你只能查询这 3 个视图，不能查其他表）

**ai_visits**（桌访记录）：
visit_id, restaurant_name, restaurant_id, table_id, visit_date, visit_period,
sentiment_score(0-100), ai_summary, feedbacks(JSONB数组), manager_questions(JSONB),
customer_answers(JSONB), keywords(JSONB), customer_source, visit_frequency, status, created_at

**ai_actions**（行动建议/待办）：
action_id, restaurant_name, restaurant_id, action_date, category(dish_quality/service_speed/environment/staff_attitude/other),
suggestion_text, priority(high/medium/low), status(pending/acknowledged/resolved/dismissed),
evidence(JSONB), assignee, deadline, source_type, created_at

**ai_feedbacks**（逐条反馈，从桌访展开）：
feedback_id, visit_id, restaurant_name, restaurant_id, visit_date, table_id,
feedback_text, sentiment(positive/negative/neutral), score(0-100)

## 查询规范
1. **只能查 ai_visits、ai_actions、ai_feedbacks** — 其他表名一律不可用
2. 限制返回行数 LIMIT 10-20
3. 按时间倒序 ORDER BY created_at DESC
4. **日期语法**：今天 \`visit_date = CURRENT_DATE\`，本周 \`visit_date >= date_trunc('week', CURRENT_DATE)\`

## 智能回答策略（重要！）
作为厨师长的助手，**只关注菜品和厨房相关**：

**问菜品反馈** → 查 ai_feedbacks，按好评/差评分类，重点关注差评原因
**问某道菜** → 查 ai_feedbacks WHERE feedback_text ILIKE '%菜名%'，总结顾客对该菜的看法
**问厨房待办/任务** → 查 ai_actions WHERE category='dish_quality' AND status='pending'，按 priority 排序（high优先）
**问趋势** → 查最近几天的 ai_feedbacks，看哪些菜持续差评
**问好评菜** → 查 ai_feedbacks WHERE sentiment='positive'，总结做对了什么

## 回答规范（非常重要）
1. **像厨房人之间聊天一样**，直接、实用、不绕弯
2. **绝对不暴露技术细节**：
   - ❌ "sentiment_score 是 85" → ✅ "顾客很满意"
   - ❌ 提及 restaurant_id、JSONB 等术语
3. **菜品问题说得具体**："花生不脆"比"口感有问题"有用100倍
4. **直接给改进方向**：发现问题时，说出具体的厨房操作建议（如"炸制时间延长30秒"）
5. **引用顾客原话**：让厨师长知道顾客真实的感受

## 诚实原则
- 查询失败 → "查询遇到问题，请稍后再试"
- 数据少 → "目前数据量较少，仅供参考"
- 不确定 → 如实说明，不编造数字

## 每日简报模式
收到 [每日汇报数据] 时，直接用数据生成汇报，不调用工具。

数据字段：negDishes(菜品差评)、posDishes(好评)、pendingTasks(厨房待办)

**格式：**
1. 时段问候 + {{USER_NAME}}
2. 一句话概况（用数据中的实际数字，不用X占位）
3. ⚠️ 菜品问题（最多3个）：菜名+顾客原话(>引用)+→改进方向
4. ✨ 好评菜（最多2个）
5. 有厨房待办时提一句数量
6. 语气直接有温度，用"哦""~""呢"等语气词
7. 无数据时友好鼓励

**【必须】回复的最后必须以下面格式结尾，生成3个追问建议，不能省略：**

:::quick-questions
- 追问建议1
- 追问建议2
- 追问建议3
:::

## 当前上下文
- 餐厅ID: {{RESTAURANT_ID}}
- 当前日期: {{CURRENT_DATE}}`;


// ===== English System Prompts =====
// Used when locale === 'en'. Data is stored in Chinese — AI translates when presenting.

const ENGLISH_PROMPT_SUFFIX = `

## Language Requirement
**Respond in English.** All data (customer quotes, dish names, feedback text) is stored in Chinese — translate to English when presenting to the user. Keep proper nouns (restaurant names, dish names) in their original form with an English explanation if needed.`;

const MANAGER_SYSTEM_PROMPT_EN = `You are Lingtin, a professional restaurant data analyst. You are talking with store manager {{USER_NAME}}, helping them improve daily operations.

## Core Principle: Understand User Intent
When receiving a question, **first determine what the user really wants**:
- Casual chat, greetings, asking who you are → Answer directly, don't query the database
- Asking about previous conversation content → Answer from chat history
- **Business questions** (visits, dishes, customers, service, etc.) → **Immediately call the query_database tool, do not say "let me check" or "please wait"**

## Queryable Views (you can ONLY query these 3 views)

**ai_visits** (visit records):
visit_id, restaurant_name, restaurant_id, table_id, visit_date, visit_period,
sentiment_score(0-100), ai_summary, feedbacks(JSONB array), manager_questions(JSONB),
customer_answers(JSONB), keywords(JSONB), customer_source, visit_frequency, status, created_at

**ai_actions** (action items/tasks):
action_id, restaurant_name, restaurant_id, action_date, category(dish_quality/service_speed/environment/staff_attitude/other),
suggestion_text, priority(high/medium/low), status(pending/acknowledged/resolved/dismissed),
evidence(JSONB), assignee, deadline, source_type, created_at

**ai_feedbacks** (individual feedback, expanded from visits):
feedback_id, visit_id, restaurant_name, restaurant_id, visit_date, table_id,
feedback_text, sentiment(positive/negative/neutral), score(0-100)

## Query Rules
1. **Only query ai_visits, ai_actions, ai_feedbacks** — no other tables
2. Limit rows: LIMIT 10-20
3. Order by time: ORDER BY created_at DESC
4. **Date syntax**: today \`visit_date = CURRENT_DATE\`, this week \`visit_date >= date_trunc('week', CURRENT_DATE)\`

## Response Guidelines
1. **Be conversational and helpful**, like talking to a colleague
2. **Never expose technical details** (no column names, JSONB, restaurant_id, etc.)
3. **Satisfaction scoring** (humanized): 80-100 = very satisfied, 60-79 = mostly satisfied, 40-59 = average, 20-39 = unsatisfied, 0-19 = very unsatisfied
4. **Cite evidence**: table numbers, dish names, customer quotes (translated)
5. **Give actionable suggestions** when issues are found
6. **Be data-driven**: use specific numbers

## Honesty
- Query failed → "There was an issue with the query, please try again later"
- Low data → "Limited data available, for reference only"
- Uncertain → Say so honestly, don't fabricate numbers

## Daily Briefing Mode
When receiving [每日汇报数据], generate a briefing directly from the data without calling tools.

Data fields: totalVisits, negVisits, posDishes, pendingActions

**Format:**
1. Time-based greeting + {{USER_NAME}}
2. One-line overview (use actual numbers)
3. ⚠️ Issues (max 3): table + customer quote (> blockquote) + → suggestion
4. ✨ Highlights (max 2)
5. Mention pending actions if any
6. Today's visit priorities
7. Friendly, warm tone
8. Encourage if no data

**[REQUIRED] End every response with 3 follow-up suggestions:**

:::quick-questions
- Follow-up suggestion 1
- Follow-up suggestion 2
- Follow-up suggestion 3
:::
${ENGLISH_PROMPT_SUFFIX}
## Current Context
- Restaurant ID: {{RESTAURANT_ID}}
- Current Date: {{CURRENT_DATE}}`;

const BOSS_SYSTEM_PROMPT_EN = `You are Lingtin, a professional restaurant data analyst. You are talking with restaurant owner {{USER_NAME}}, helping them gain business insights.

## Core Principle: Understand User Intent
When receiving a question, **first determine what the user really wants**:
- Casual chat, greetings, asking who you are → Answer directly, don't query the database
- Asking about previous conversation content → Answer from chat history
- **Business questions** (visits, dishes, customers, service, etc.) → **Immediately call the query_database tool, do not say "let me check" or "please wait"**

## Queryable Views (you can ONLY query these 3 views)

**ai_visits** (visit records):
visit_id, restaurant_name, restaurant_id, table_id, visit_date, visit_period,
sentiment_score(0-100), ai_summary, feedbacks(JSONB array), manager_questions(JSONB),
customer_answers(JSONB), keywords(JSONB), customer_source, visit_frequency, status, created_at

**ai_actions** (action items/tasks):
action_id, restaurant_name, restaurant_id, action_date, category(dish_quality/service_speed/environment/staff_attitude/other),
suggestion_text, priority(high/medium/low), status(pending/acknowledged/resolved/dismissed),
evidence(JSONB), assignee, deadline, source_type, created_at

**ai_feedbacks** (individual feedback, expanded from visits):
feedback_id, visit_id, restaurant_name, restaurant_id, visit_date, table_id,
feedback_text, sentiment(positive/negative/neutral), score(0-100)

## Query Rules
1. **Only query ai_visits, ai_actions, ai_feedbacks** — no other tables
2. Limit rows: LIMIT 10-20
3. Order by time: ORDER BY created_at DESC
4. **Date syntax**: today \`visit_date = CURRENT_DATE\`, this week \`visit_date >= date_trunc('week', CURRENT_DATE)\`

## Smart Response Strategy
**Overall business** → Query ai_visits sentiment_score trends, group by restaurant_name
**Dish feedback** → Query ai_feedbacks, rank by positive/negative
**Customer satisfaction** → Query ai_visits sentiment_score distribution
**Manager execution** → Query ai_visits manager_questions
**Negative feedback** → Query ai_feedbacks WHERE sentiment='negative'
**Cross-store tasks** → Query ai_actions WHERE status='pending', group by restaurant_name + sort by priority

## Response Guidelines
1. **Be concise, insightful, data-driven** — like a business report
2. **Never expose technical details** (no column names, JSONB, restaurant_id, etc.)
3. **Satisfaction scoring** (humanized): 80-100 = very satisfied, 60-79 = mostly satisfied, 40-59 = average, 20-39 = unsatisfied, 0-19 = very unsatisfied
4. **Highlight key metrics**: coverage rate, satisfaction trends, issue counts
5. **Give business recommendations** based on data
6. **Comparative analysis**: compare with last week/month, show trends

## Honesty
- Query failed → "There was an issue with the query, please try again later"
- Low data → "Limited data available, for reference only"
- Uncertain → Say so honestly, don't fabricate numbers

## Daily Briefing Mode
When receiving [每日汇报数据], generate a briefing directly from the data without calling tools.

Data fields: visits (per store), negStores (anomalous stores), negDishes (cross-store complaints), pendingItems (backlog)

**Format:**
1. Time-based greeting + {{USER_NAME}}
2. One-line global overview (use actual numbers)
3. ⚠️ Problem stores (max 3): store name + anomaly + suggestion
4. Cross-store common complaints → unified adjustment suggestions
5. Execution signal (pending backlog)
6. ✨ Highlights (max 2)
7. Professional but warm tone
8. Encourage if no data

**[REQUIRED] End every response with 3 follow-up suggestions:**

:::quick-questions
- Follow-up suggestion 1
- Follow-up suggestion 2
- Follow-up suggestion 3
:::
${ENGLISH_PROMPT_SUFFIX}
## Current Context
- Restaurant ID: {{RESTAURANT_ID}}
- Current Date: {{CURRENT_DATE}}`;

const CHEF_SYSTEM_PROMPT_EN = `You are Lingtin, a professional kitchen operations assistant. You are talking with head chef {{USER_NAME}}, helping them improve dish quality and kitchen efficiency.

## Core Principle: Understand User Intent
When receiving a question, **first determine what the user really wants**:
- Casual chat, greetings, asking who you are → Answer directly, don't query the database
- Asking about previous conversation content → Answer from chat history
- **Business questions** (dishes, feedback, kitchen tasks, etc.) → **Immediately call the query_database tool, do not say "let me check" or "please wait"**

## Queryable Views (you can ONLY query these 3 views)

**ai_visits** (visit records):
visit_id, restaurant_name, restaurant_id, table_id, visit_date, visit_period,
sentiment_score(0-100), ai_summary, feedbacks(JSONB array), manager_questions(JSONB),
customer_answers(JSONB), keywords(JSONB), customer_source, visit_frequency, status, created_at

**ai_actions** (action items/tasks):
action_id, restaurant_name, restaurant_id, action_date, category(dish_quality/service_speed/environment/staff_attitude/other),
suggestion_text, priority(high/medium/low), status(pending/acknowledged/resolved/dismissed),
evidence(JSONB), assignee, deadline, source_type, created_at

**ai_feedbacks** (individual feedback, expanded from visits):
feedback_id, visit_id, restaurant_name, restaurant_id, visit_date, table_id,
feedback_text, sentiment(positive/negative/neutral), score(0-100)

## Query Rules
1. **Only query ai_visits, ai_actions, ai_feedbacks** — no other tables
2. Limit rows: LIMIT 10-20
3. Order by time: ORDER BY created_at DESC
4. **Date syntax**: today \`visit_date = CURRENT_DATE\`, this week \`visit_date >= date_trunc('week', CURRENT_DATE)\`

## Smart Response Strategy (Kitchen Focus)
**Dish feedback** → Query ai_feedbacks, categorize by positive/negative, focus on negative reasons
**Specific dish** → Query ai_feedbacks WHERE feedback_text ILIKE '%dish_name%', summarize customer opinions
**Kitchen tasks** → Query ai_actions WHERE category='dish_quality' AND status='pending', sort by priority (high first)
**Trends** → Query recent ai_feedbacks, identify dishes with persistent complaints
**Praised dishes** → Query ai_feedbacks WHERE sentiment='positive', summarize what's working

## Response Guidelines
1. **Be direct and practical** — like kitchen people talking to each other
2. **Never expose technical details** (no column names, JSONB, restaurant_id, etc.)
3. **Be specific about dish issues**: "peanuts aren't crispy enough" is 100x more useful than "texture issues"
4. **Give concrete kitchen suggestions**: e.g., "extend frying time by 30 seconds"
5. **Quote customers** (translated): let the chef know real customer sentiment

## Honesty
- Query failed → "There was an issue with the query, please try again later"
- Low data → "Limited data available, for reference only"
- Uncertain → Say so honestly, don't fabricate numbers

## Daily Briefing Mode
When receiving [每日汇报数据], generate a briefing directly from the data without calling tools.

Data fields: negDishes (complaints), posDishes (praised), pendingTasks (kitchen tasks)

**Format:**
1. Time-based greeting + {{USER_NAME}}
2. One-line overview (use actual numbers)
3. ⚠️ Dish issues (max 3): dish name + customer quote (> blockquote) + → improvement direction
4. ✨ Praised dishes (max 2)
5. Mention kitchen tasks if any
6. Direct but warm tone
7. Encourage if no data

**[REQUIRED] End every response with 3 follow-up suggestions:**

:::quick-questions
- Follow-up suggestion 1
- Follow-up suggestion 2
- Follow-up suggestion 3
:::
${ENGLISH_PROMPT_SUFFIX}
## Current Context
- Restaurant ID: {{RESTAURANT_ID}}
- Current Date: {{CURRENT_DATE}}`;


// Tool definitions for function calling
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'query_database',
      description: `查询餐厅数据的只读视图。只支持 SELECT，只能查 ai_visits、ai_actions、ai_feedbacks 三个视图。

ai_visits（桌访记录）: visit_id, restaurant_name, restaurant_id, table_id, visit_date, visit_period, sentiment_score(0-100), ai_summary, feedbacks(JSONB数组), manager_questions(JSONB), customer_answers(JSONB), keywords(JSONB), customer_source, visit_frequency, status, created_at

ai_actions（行动建议/待办）: action_id, restaurant_name, restaurant_id, action_date, category(dish_quality/service_speed/environment/staff_attitude/other), suggestion_text, priority(high/medium/low), status(pending/acknowledged/resolved/dismissed), evidence(JSONB), assignee, deadline, source_type, created_at

ai_feedbacks（逐条反馈）: feedback_id, visit_id, restaurant_name, restaurant_id, visit_date, table_id, feedback_text, sentiment(positive/negative/neutral), score(0-100)`,
      parameters: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description: 'SQL SELECT 查询语句。例如: SELECT feedback_text, sentiment, score FROM ai_feedbacks WHERE sentiment = \'negative\' ORDER BY visit_date DESC LIMIT 10',
          },
          purpose: {
            type: 'string',
            description: '查询目的的简要说明，用于日志记录',
          },
        },
        required: ['sql', 'purpose'],
      },
    },
  },
];

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly knowledgeService: KnowledgeService,
  ) {
    this.logger.log(`Initializing with OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT SET'}`);
  }

  async streamResponse(
    message: string,
    restaurantId: string,
    sessionId: string | undefined,
    history: Array<{ role: string; content: string }> | undefined,
    roleCode: string | undefined,
    userName: string | undefined,
    employeeId: string | undefined,
    res: Response,
    managedRestaurantIds: string[] | null = null,
    locale: string | undefined = undefined,
  ) {
this.logger.log(`Chat request: ${message.slice(0, 50)}...`);
this.logger.log(`Role: ${roleCode}, User: ${userName}`);

    const currentDate = getChinaDateString();

    // Select system prompt based on role (3-way: boss / chef / manager) and locale
    const isChef = roleCode === 'head_chef' || roleCode === 'chef';
    const isBoss = roleCode === 'administrator';
    const useEnglish = locale === 'en';
    const basePrompt = useEnglish
      ? (isBoss ? BOSS_SYSTEM_PROMPT_EN : isChef ? CHEF_SYSTEM_PROMPT_EN : MANAGER_SYSTEM_PROMPT_EN)
      : (isBoss ? BOSS_SYSTEM_PROMPT : isChef ? CHEF_SYSTEM_PROMPT : MANAGER_SYSTEM_PROMPT);
    const systemPrompt = basePrompt
      .replace('{{RESTAURANT_ID}}', restaurantId)
      .replace('{{CURRENT_DATE}}', currentDate)
      .replace('{{USER_NAME}}', userName || (useEnglish ? 'User' : '用户'));

    // Enrich system prompt with knowledge store context
    let enrichedSystemPrompt = systemPrompt;
    try {
      enrichedSystemPrompt = await this.knowledgeService.enrichPrompt(systemPrompt, {
        restaurantId,
        operation: 'chat',
      });
    } catch (e) {
      this.logger.warn('Knowledge enrichment failed for chat, using base prompt');
    }

    // Build messages array with conversation history
    const messages: ChatMessage[] = [];

    // Add history messages (already includes current user message from frontend)
    if (history && history.length > 0) {
      for (const msg of history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          });
        }
      }
      this.logger.log(`Added ${messages.length} messages from history`);
    } else {
      // Fallback: if no history provided, add current message
      messages.push({ role: 'user', content: message });
    }

this.logger.log(`Messages in context: ${messages.length}`);

    const isBriefing = message === '__DAILY_BRIEFING__';

    try {
      let content: string;

      if (isBriefing) {
        // === Briefing mode: pre-fetch data, real streaming, no tools ===
        res.write(`data: ${JSON.stringify({ type: 'thinking', content: useEnglish ? 'Querying business data...' : '正在查询经营数据...' })}\n\n`);

        const briefingData = await this.prefetchBriefingData(
          roleCode || 'manager',
          restaurantId,
          managedRestaurantIds,
        );

        // Replace __DAILY_BRIEFING__ with pre-fetched data
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === 'user') {
          lastMsg.content = briefingData;
        }

        res.write(`data: ${JSON.stringify({ type: 'thinking', content: useEnglish ? 'Generating today\'s briefing...' : '正在生成今日汇报...' })}\n\n`);

        // Stream directly from OpenRouter → client (real SSE streaming)
        content = await this.streamBriefingResponse(enrichedSystemPrompt, messages, res);
        this.logger.log(`[Briefing] Streamed response length: ${content.length}`);
      } else {
        // === Regular chat: agentic loop with tool calls ===
        // Heartbeat keeps connection alive during multi-tool queries (3 rounds × 15s = 45s)
        const chatHeartbeat = this.startHeartbeat(res);

        try {
          let iteration = 0;
          const maxIterations = 5;
          content = '';

          const chatStart = Date.now();

          while (iteration < maxIterations) {
            iteration++;
            const turnStart = Date.now();
            this.logger.log(`[Chat Turn ${iteration}/${maxIterations}] Calling AI...`);

            const thinkingMessage = iteration === 1
              ? (useEnglish ? 'Thinking...' : '正在思考...')
              : (useEnglish ? 'Organizing response...' : '正在整理答案...');
            res.write(`data: ${JSON.stringify({ type: 'thinking', content: thinkingMessage })}\n\n`);

            const apiStart = Date.now();
            const response = await this.callClaudeAPI(enrichedSystemPrompt, messages);
            const apiMs = Date.now() - apiStart;

            if (!response.choices || response.choices.length === 0) {
              throw new Error('Empty response from API');
            }

            const assistantMessage = response.choices[0].message;
            const usage = response.usage;
            const tokenInfo = usage ? `prompt=${usage.prompt_tokens} comp=${usage.completion_tokens}` : 'no usage';
            this.logger.log(`[Chat Turn ${iteration}] AI responded in ${(apiMs / 1000).toFixed(1)}s | ${tokenInfo}`);

            // Check if there are tool calls to process
            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
              this.logger.log(`[Chat Turn ${iteration}] ${assistantMessage.tool_calls.length} tool call(s):`);

              for (const tc of assistantMessage.tool_calls) {
                this.logger.log(`  → ${tc.function.name}(${tc.function.arguments.slice(0, 200)})`);
              }

              messages.push({
                role: 'assistant',
                content: assistantMessage.content || '',
                tool_calls: assistantMessage.tool_calls,
              });

              for (const toolCall of assistantMessage.tool_calls) {
                let thinkingStatus = useEnglish ? 'Querying data...' : '正在查询数据...';
                try {
                  const args = JSON.parse(toolCall.function.arguments);
                  if (args.purpose) {
                    thinkingStatus = useEnglish
                      ? `${args.purpose.slice(0, 30)}...`
                      : `正在${args.purpose.slice(0, 20)}...`;
                  }
                } catch {
                  // Use default thinking status
                }

                res.write(`data: ${JSON.stringify({ type: 'thinking', content: thinkingStatus })}\n\n`);

                const toolStart = Date.now();
                const result = await this.executeToolCall(toolCall);
                const toolMs = Date.now() - toolStart;
                const resultStr = JSON.stringify(result);
                this.logger.log(`  ← ${toolCall.function.name} ${toolMs}ms | ${resultStr.length} chars`);

                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: resultStr,
                });

                res.write(`data: ${JSON.stringify({
                  type: 'tool_use',
                  tool: toolCall.function.name,
                  status: 'completed'
                })}\n\n`);
              }

              const turnMs = Date.now() - turnStart;
              this.logger.log(`[Chat Turn ${iteration}] turn total: ${(turnMs / 1000).toFixed(1)}s`);
              continue;
            }

            // No tool calls - final response
            content = assistantMessage.content || '';
            const totalMs = Date.now() - chatStart;
            this.logger.log(`[Chat Done] ${iteration} turn(s) | total ${(totalMs / 1000).toFixed(1)}s | response ${content.length} chars`);
            break;
          }
        } finally {
          clearInterval(chatHeartbeat);
        }
      }

      // Guard: detect gibberish (model hallucination) — if <15% Chinese chars, replace with friendly message
      // For briefing (already streamed), only log — cannot un-send streamed text.
      // temperature: 0 makes gibberish extremely unlikely for briefing mode.
      if (content.length > 50) {
        const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
        const ratio = chineseChars / content.length;
        if (ratio < 0.15) {
          this.logger.warn(`[Guard] Gibberish detected: ${content.length} chars, ${(ratio * 100).toFixed(1)}% Chinese. First 100: ${content.slice(0, 100)}`);
          if (!isBriefing) {
            content = '抱歉，AI 生成内容出现异常，请点击「清空对话」重新生成。';
          }
        }
      }

      if (!isBriefing) {
        // Regular chat: simulate streaming with paced chunks (briefing already streamed)
        // 6-char chunks at 20ms intervals ≈ 300 chars/sec, feels like natural LLM output
        const chunkSize = 6;
        for (let i = 0; i < content.length; i += chunkSize) {
          const chunk = content.slice(i, i + chunkSize);
          res.write(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`);
          if (i + chunkSize < content.length) {
            await new Promise(r => setTimeout(r, 20));
          }
        }
      }

      // Save chat history to database (non-blocking)
      this.saveChatHistory(
        message,
        content,
        restaurantId,
        sessionId,
        employeeId,
        userName,
      ).catch(err => this.logger.error(`Failed to save chat history: ${err.message}`));

      res.write('data: [DONE]\n\n');
      res.end();
      this.logger.log('Response stream completed');

    } catch (error) {
      this.logger.error(`Error: ${error.message}`);
      res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
      res.end();
    }
  }

  /**
   * Call AI API via OpenRouter endpoint
   */
  private async callClaudeAPI(systemPrompt: string, messages: ChatMessage[]) {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    const requestBody: Record<string, any> = {
      model: 'google/gemini-3-flash-preview',
      max_tokens: 2048,
      thinking: { type: 'enabled', budget_tokens: 512 },
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      tools: TOOLS,
      tool_choice: 'auto',
    };

    this.logger.log(`[OpenRouter] model=${requestBody.model} msgs=${messages.length} max_tokens=${requestBody.max_tokens}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`API error: ${response.status} - ${errorText}`);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      // JSON parsing also covered by the abort signal timeout
      const json = await response.json();
      return json;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('AI 响应超时，请稍后重试');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Stream a briefing response from OpenRouter with real SSE.
   * Forwards each text delta to the client immediately and returns the accumulated content.
   */
  private async streamBriefingResponse(
    systemPrompt: string,
    messages: ChatMessage[],
    res: Response,
  ): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

    const requestBody = {
      model: 'google/gemini-3-flash-preview',
      max_tokens: 1024,
      thinking: { type: 'enabled', budget_tokens: 256 },
      temperature: 0,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    // Heartbeat as fallback — real text chunks will arrive every ~100ms
    const heartbeat = this.startHeartbeat(res, 5_000);

    let accumulated = '';
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last potentially incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);
          if (payload === '[DONE]') continue;

          try {
            const chunk = JSON.parse(payload);
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              res.write(`data: ${JSON.stringify({ type: 'text', content: delta })}\n\n`);
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      return accumulated;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('AI 响应超时，请稍后重试');
      }
      throw err;
    } finally {
      await reader?.cancel().catch(() => {});
      clearTimeout(timeout);
      clearInterval(heartbeat);
    }
  }

  /** Send a periodic heartbeat to keep the SSE connection alive across proxies. */
  private startHeartbeat(res: Response, intervalMs = 10_000): ReturnType<typeof setInterval> {
    return setInterval(() => {
      try { res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`); } catch {}
    }, intervalMs);
  }

  /**
   * Execute a tool call and return the result
   */
  private async executeToolCall(
    toolCall: { id: string; type: string; function: { name: string; arguments: string } },
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const { name, arguments: argsJson } = toolCall.function;

    this.logger.log(`Executing tool: ${name}`);

    try {
      const args = JSON.parse(argsJson);

      if (name === 'query_database') {
        const { sql, purpose } = args;
        this.logger.log(`[query_database] ${purpose}`);

        const result = await this.executeQuery(sql);
        this.logger.log(`[query_database] Returned ${result?.length || 0} rows`);

        return { success: true, data: result };
      }

      return { success: false, error: `Unknown tool: ${name}` };
    } catch (error) {
      this.logger.error(`Tool execution error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run a raw SQL query bypassing scope injection (for server-side pre-fetch only)
   */
  private async runRawQuery(sql: string): Promise<any[]> {
    const client = this.supabase.getClient();
    // Must trim: template literal SQL has leading \n that PostgreSQL TRIM() doesn't remove,
    // causing the RPC's "LIKE 'select%'" check to fail
    const trimmedSql = sql.replace(/\s+/g, ' ').trim();
    const QUERY_TIMEOUT = 10_000; // 10s per query, fail fast

    try {
      const queryPromise = client.rpc('execute_readonly_query', {
        query_text: trimmedSql,
      });
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Query timeout (10s)')), QUERY_TIMEOUT);
      });

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]).finally(() => clearTimeout(timer!));
      if (error) {
        this.logger.error(`[runRawQuery] RPC failed: ${error.message} | SQL: ${trimmedSql.slice(0, 80)}`);
        return [];
      }
      return data || [];
    } catch (err) {
      this.logger.error(`[runRawQuery] Error: ${err.message} | SQL: ${trimmedSql.slice(0, 80)}`);
      return [];
    }
  }

  /**
   * Pre-fetch all briefing data server-side for deterministic results.
   * Returns a formatted data message to inject into the AI prompt.
   */
  private async prefetchBriefingData(
    roleCode: string,
    restaurantId: string,
    managedRestaurantIds: string[] | null,
  ): Promise<string> {
    const PREFETCH_TIMEOUT = 20_000; // 20s total for all queries

    try {
      const dataPromise = this.doPrefetchBriefingData(roleCode, restaurantId, managedRestaurantIds);
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<string>((_, reject) => {
        timer = setTimeout(() => reject(new Error('数据查询超时')), PREFETCH_TIMEOUT);
      });
      return await Promise.race([dataPromise, timeoutPromise]).finally(() => clearTimeout(timer!));
    } catch (err) {
      this.logger.error(`[prefetchBriefingData] Failed: ${err.message}`);
      // Return minimal fallback so AI can still generate a useful response
      return '[每日汇报数据]\n数据查询失败，请根据你对门店的了解生成一份简短的问候汇报，告知用户数据暂时不可用，建议稍后重试。\n';
    }
  }

  private async doPrefetchBriefingData(
    roleCode: string,
    restaurantId: string,
    managedRestaurantIds: string[] | null,
  ): Promise<string> {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const DEFAULT_RESTAURANT_ID = '0b9e9031-4223-4124-b633-e3a853abfb8f';
    const safeId = UUID_RE.test(restaurantId) ? restaurantId : DEFAULT_RESTAURANT_ID;

    const isChef = roleCode === 'head_chef' || roleCode === 'chef';
    const isBoss = roleCode === 'administrator';

    // Build scope filter for SQL WHERE clauses
    const scopeFor = (alias?: string): string => {
      const col = alias ? `${alias}.restaurant_id` : 'restaurant_id';
      if (isBoss && (!managedRestaurantIds || managedRestaurantIds.length === 0)) {
        return ''; // HQ boss sees all stores
      }
      if (managedRestaurantIds && managedRestaurantIds.length > 0) {
        const validIds = managedRestaurantIds.filter(id => UUID_RE.test(id));
        if (validIds.length === 0) return `AND ${col} = '${safeId}'`;
        return `AND ${col} IN (${validIds.map(id => `'${id}'`).join(',')})`;
      }
      return `AND ${col} = '${safeId}'`;
    };

    let dataText = '[每日汇报数据]\n以下是系统为你预查询的昨日经营数据，请根据这些数据生成每日汇报。\n\n';

    if (isBoss) {
      const [visits, negStores, negDishes, pendingItems] = await Promise.all([
        this.runRawQuery(`
          SELECT vr.restaurant_id, mr.restaurant_name, COUNT(*) as total
          FROM lingtin_visit_records vr
          JOIN master_restaurant mr ON vr.restaurant_id = mr.id
          WHERE vr.visit_date = (CURRENT_DATE AT TIME ZONE 'Asia/Shanghai')::date - 1 ${scopeFor('vr')}
          GROUP BY vr.restaurant_id, mr.restaurant_name
        `),
        this.runRawQuery(`
          SELECT vr.restaurant_id, mr.restaurant_name, COUNT(*) as neg_count
          FROM lingtin_visit_records vr
          JOIN master_restaurant mr ON vr.restaurant_id = mr.id
          WHERE vr.visit_date = (CURRENT_DATE AT TIME ZONE 'Asia/Shanghai')::date - 1 AND vr.sentiment_score < 40 ${scopeFor('vr')}
          GROUP BY vr.restaurant_id, mr.restaurant_name
          ORDER BY neg_count DESC LIMIT 3
        `),
        this.runRawQuery(`
          SELECT f->>'text' as feedback_text, COUNT(*) as mention_count,
                 mr.restaurant_name
          FROM lingtin_visit_records vr
          JOIN master_restaurant mr ON vr.restaurant_id = mr.id,
               jsonb_array_elements(vr.feedbacks) f
          WHERE vr.feedbacks IS NOT NULL
            AND vr.visit_date = (CURRENT_DATE AT TIME ZONE 'Asia/Shanghai')::date - 1
            AND f->>'sentiment' = 'negative' ${scopeFor('vr')}
          GROUP BY f->>'text', mr.restaurant_name
          ORDER BY mention_count DESC LIMIT 5
        `),
        this.runRawQuery(`
          SELECT ai.restaurant_id, mr.restaurant_name, COUNT(*) as pending_count
          FROM lingtin_action_items ai
          JOIN master_restaurant mr ON ai.restaurant_id = mr.id
          WHERE ai.status = 'pending' ${scopeFor('ai')}
          GROUP BY ai.restaurant_id, mr.restaurant_name
          ORDER BY pending_count DESC LIMIT 5
        `),
      ]);
      dataText += `## 各门店昨日桌访量\nvisits: ${JSON.stringify(visits)}\n\n`;
      dataText += `## 异常门店（差评集中）\nnegStores: ${JSON.stringify(negStores)}\n\n`;
      dataText += `## 跨店共性差评菜品\nnegDishes: ${JSON.stringify(negDishes)}\n\n`;
      dataText += `## 行动建议积压\npendingItems: ${JSON.stringify(pendingItems)}\n`;
    } else if (isChef) {
      const [negDishes, posDishes, pendingTasks] = await Promise.all([
        this.runRawQuery(`
          SELECT vr.table_id, f->>'text' as feedback_text
          FROM lingtin_visit_records vr,
               jsonb_array_elements(vr.feedbacks) f
          WHERE vr.feedbacks IS NOT NULL
            AND vr.visit_date = (CURRENT_DATE AT TIME ZONE 'Asia/Shanghai')::date - 1
            AND f->>'sentiment' = 'negative' ${scopeFor('vr')}
          ORDER BY vr.created_at DESC LIMIT 10
        `),
        this.runRawQuery(`
          SELECT f->>'text' as feedback_text
          FROM lingtin_visit_records vr,
               jsonb_array_elements(vr.feedbacks) f
          WHERE vr.feedbacks IS NOT NULL
            AND vr.visit_date = (CURRENT_DATE AT TIME ZONE 'Asia/Shanghai')::date - 1
            AND f->>'sentiment' = 'positive' ${scopeFor('vr')}
          LIMIT 5
        `),
        this.runRawQuery(`
          SELECT COUNT(*) as cnt, priority
          FROM lingtin_action_items
          WHERE category = 'dish_quality' AND status = 'pending' ${scopeFor()}
          GROUP BY priority
        `),
      ]);
      dataText += `## 昨日菜品差评\nnegDishes: ${JSON.stringify(negDishes)}\n\n`;
      dataText += `## 昨日菜品好评\nposDishes: ${JSON.stringify(posDishes)}\n\n`;
      dataText += `## 厨房待办\npendingTasks: ${JSON.stringify(pendingTasks)}\n`;
    } else {
      // Store manager
      const [totalVisits, negVisits, posDishes, pendingActions] = await Promise.all([
        this.runRawQuery(`
          SELECT COUNT(*) as total
          FROM lingtin_visit_records
          WHERE visit_date = (CURRENT_DATE AT TIME ZONE 'Asia/Shanghai')::date - 1 ${scopeFor()}
        `),
        this.runRawQuery(`
          SELECT table_id, ai_summary, sentiment_score
          FROM lingtin_visit_records
          WHERE visit_date = (CURRENT_DATE AT TIME ZONE 'Asia/Shanghai')::date - 1 AND sentiment_score < 40 ${scopeFor()}
          LIMIT 5
        `),
        this.runRawQuery(`
          SELECT f->>'text' as feedback_text
          FROM lingtin_visit_records vr,
               jsonb_array_elements(vr.feedbacks) f
          WHERE vr.feedbacks IS NOT NULL
            AND vr.visit_date = (CURRENT_DATE AT TIME ZONE 'Asia/Shanghai')::date - 1
            AND f->>'sentiment' = 'positive' ${scopeFor('vr')}
          LIMIT 5
        `),
        this.runRawQuery(`
          SELECT COUNT(*) as cnt
          FROM lingtin_action_items
          WHERE status = 'pending' ${scopeFor()}
        `),
      ]);
      dataText += `## 昨日桌访统计\ntotalVisits: ${JSON.stringify(totalVisits)}\n\n`;
      dataText += `## 差评反馈（满意度 < 40）\nnegVisits: ${JSON.stringify(negVisits)}\n\n`;
      dataText += `## 好评菜品\nposDishes: ${JSON.stringify(posDishes)}\n\n`;
      dataText += `## 待处理行动建议\npendingActions: ${JSON.stringify(pendingActions)}\n`;
    }

    this.logger.log(`[prefetchBriefingData] Role: ${roleCode}, data length: ${dataText.length}`);
    return dataText;
  }

  /**
   * Execute AI-generated SQL against read-only materialized views.
   * Security is enforced at the database level:
   * - AI can ONLY query ai_visits, ai_actions, ai_feedbacks (materialized views)
   * - Views contain no sensitive fields (no raw_transcript, audio_url)
   * - Views are refreshed every 5 min via pg_cron
   * - No SQL rewriting, no regex injection — just validate and execute
   */
  private async executeQuery(sql: string): Promise<any[]> {
    const normalizedSql = sql.trim().toLowerCase().replace(/\s+/g, ' ');

    // Must be a SELECT statement
    if (!normalizedSql.startsWith('select ')) {
      throw new Error('Only SELECT queries are allowed');
    }

    // Only allow queries on materialized views
    const allowedViews = ['ai_visits', 'ai_actions', 'ai_feedbacks'];
    const fromPattern = /(?:from|join)\s+([a-z_]+)/gi;
    const matches = [...normalizedSql.matchAll(fromPattern)];

    if (matches.length === 0) {
      throw new Error('Query must reference a view: ai_visits, ai_actions, or ai_feedbacks');
    }

    for (const match of matches) {
      if (!allowedViews.includes(match[1])) {
        throw new Error(`Only these views are allowed: ${allowedViews.join(', ')}. Got: ${match[1]}`);
      }
    }

    this.logger.log(`[executeQuery] SQL: ${sql.slice(0, 150)}...`);

    const client = this.supabase.getClient();
    const { data, error } = await client.rpc('execute_readonly_query', {
      query_text: sql.trim(),
    });

    if (error) {
      this.logger.error(`[executeQuery] RPC error: ${error.message}`);
      throw new Error(`Query failed: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Save chat history to database for staff-questions feature
   */
  private async saveChatHistory(
    userMessage: string,
    assistantResponse: string,
    restaurantId: string,
    sessionId: string | undefined,
    employeeId: string | undefined,
    employeeName: string | undefined,
  ): Promise<void> {
    const client = this.supabase.getClient();

    // Generate session ID if not provided
    const chatSessionId = sessionId || randomUUID();

    // Insert user message
    await client.from('chat_history').insert({
      session_id: chatSessionId,
      user_id: employeeId || null,
      role: 'user',
      content: userMessage,
      restaurant_id: restaurantId,
      employee_name: employeeName || null,
    });

    // Insert assistant response
    await client.from('chat_history').insert({
      session_id: chatSessionId,
      user_id: employeeId || null,
      role: 'assistant',
      content: assistantResponse,
      restaurant_id: restaurantId,
      employee_name: employeeName || null,
    });

    this.logger.log(`Saved chat history for session ${chatSessionId}`);
  }

  async getSessions(restaurantId: string) {
    return { sessions: [] };
  }
}
