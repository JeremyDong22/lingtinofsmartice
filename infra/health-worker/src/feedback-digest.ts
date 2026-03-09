import type { Env } from './types';
import { sendBark } from './notify';

interface Feedback {
  id: string;
  content_text: string | null;
  raw_transcript: string | null;
  category: string | null;
  status: string;
  priority: string | null;
  created_at: string;
  admin_reply: string | null;
}

interface Priority {
  title: string;
  description: string;
  category: string;
  severity: 'high' | 'medium' | 'low';
  feedback_ids: string[];
}

interface DigestResult {
  summary: string;
  priorities: Priority[];
}

const DIGEST_COOLDOWN_MS = 60_000; // Skip if last digest was <60s ago

/** Fetch all unresolved feedbacks from Supabase REST API */
async function fetchPendingFeedbacks(env: Env): Promise<Feedback[]> {
  const url =
    `${env.SUPABASE_URL}/rest/v1/lingtin_product_feedback` +
    `?status=not.in.%28resolved%2Cdismissed%29` +
    `&order=created_at.desc` +
    `&select=id,content_text,raw_transcript,category,status,priority,created_at,admin_reply`;

  const resp = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!resp.ok) {
    throw new Error(`Supabase query failed: ${resp.status} ${resp.statusText}`);
  }

  return resp.json();
}

/** Check if a digest was generated recently (dedup) */
async function hasRecentDigest(env: Env): Promise<boolean> {
  const since = new Date(Date.now() - DIGEST_COOLDOWN_MS).toISOString();
  const url =
    `${env.SUPABASE_URL}/rest/v1/lingtin_feedback_digests` +
    `?created_at=gte.${since}` +
    `&select=id` +
    `&limit=1`;

  const resp = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!resp.ok) return false;
  const data = (await resp.json()) as { id: string }[];
  return data.length > 0;
}

/** Call OpenRouter DeepSeek V3 for analysis */
async function analyzeWithAI(
  env: Env,
  feedbacks: Feedback[],
  triggerFeedbackId?: string,
): Promise<{ parsed: DigestResult; raw: string }> {
  const feedbackText = feedbacks
    .map((f) => {
      const isNew = f.id === triggerFeedbackId ? ' ★NEW' : '';
      const cat = f.category || '未分类';
      const content = f.content_text || f.raw_transcript || '(无内容)';
      return `[${f.id}]${isNew} (${cat}, ${f.status}, ${f.priority || '未定'}) ${content}`;
    })
    .join('\n');

  const systemPrompt = `你是一个餐饮 SaaS 产品的技术产品经理。你正在审阅员工提交的产品使用反馈。

${triggerFeedbackId ? '刚刚收到一条新反馈（标记为 ★NEW），请结合所有待处理反馈进行综合分析。' : '请对所有待处理反馈进行综合分析。'}

你的任务：
1. 把相关反馈归类合并（同一问题的不同反馈合并为一条开发任务）
2. 为每个问题给出开发建议（具体到应该改什么、怎么改）
3. 按紧急程度排序（影响核心流程 > 体验优化 > 锦上添花）
4. 生成一段 80 字以内的整体摘要${triggerFeedbackId ? '，开头说明新反馈的核心诉求' : ''}

输出纯 JSON（不要 markdown 代码块）：
{
  "summary": "整体摘要（80字以内）",
  "priorities": [
    {
      "title": "问题标题（15字以内）",
      "description": "问题描述 + 开发建议（100字以内）",
      "category": "bug | feature_request | usability | performance | content",
      "severity": "high | medium | low",
      "feedback_ids": ["关联的反馈ID"]
    }
  ]
}`;

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `待处理反馈共 ${feedbacks.length} 条：\n${feedbackText}` },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`OpenRouter API failed: ${resp.status} ${body}`);
  }

  const data = (await resp.json()) as {
    choices: { message: { content: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content || '';

  // Parse JSON from response (handle potential markdown wrapping)
  let jsonStr = raw.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed: DigestResult;
  try {
    parsed = JSON.parse(jsonStr) as DigestResult;
  } catch {
    console.error('[feedback-digest] Failed to parse AI response:', jsonStr.slice(0, 200));
    parsed = { summary: 'AI 分析解析失败，请查看原始输出', priorities: [] };
  }

  return { parsed, raw };
}

/** Write digest to Supabase */
async function saveDigest(
  env: Env,
  triggerFeedbackId: string | undefined,
  feedbackIds: string[],
  totalPending: number,
  result: DigestResult,
  rawResponse: string,
): Promise<void> {
  const url = `${env.SUPABASE_URL}/rest/v1/lingtin_feedback_digests`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      trigger_feedback_id: triggerFeedbackId || null,
      feedback_ids: feedbackIds,
      total_pending: totalPending,
      summary: result.summary,
      priorities: result.priorities,
      raw_ai_response: rawResponse,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Failed to save digest: ${resp.status} ${body}`);
  }
}

/** Main entry: run feedback digest analysis */
export async function runFeedbackDigest(
  env: Env,
  triggerFeedbackId?: string,
): Promise<void> {
  console.log(`[feedback-digest] Starting${triggerFeedbackId ? ` (trigger: ${triggerFeedbackId})` : ''}`);

  // Dedup: skip if a digest was generated recently
  if (await hasRecentDigest(env)) {
    console.log('[feedback-digest] Skipping: recent digest exists (<60s)');
    return;
  }

  // 1. Fetch pending feedbacks
  const feedbacks = await fetchPendingFeedbacks(env);
  console.log(`[feedback-digest] Found ${feedbacks.length} pending feedbacks`);

  if (feedbacks.length === 0) {
    console.log('[feedback-digest] No pending feedbacks, skipping');
    return;
  }

  // 2. AI analysis
  const { parsed, raw } = await analyzeWithAI(env, feedbacks, triggerFeedbackId);
  console.log(`[feedback-digest] AI returned ${parsed.priorities.length} priorities`);

  // 3. Save to DB + Bark push (parallel)
  const feedbackIds = feedbacks.map((f) => f.id);
  const priorityLines = parsed.priorities
    .slice(0, 3)
    .map((p, i) => `${i + 1}. ${p.title}(${p.severity})`)
    .join('\n');
  const pushBody = `${parsed.summary}\n待处理共${feedbacks.length}条，建议优先：\n${priorityLines}`;

  await Promise.all([
    saveDigest(env, triggerFeedbackId, feedbackIds, feedbacks.length, parsed, raw),
    sendBark(env, '📋 新反馈 + 开发建议', pushBody, 'alert', 'lingtin-feedback'),
  ]);

  console.log('[feedback-digest] Done');
}
