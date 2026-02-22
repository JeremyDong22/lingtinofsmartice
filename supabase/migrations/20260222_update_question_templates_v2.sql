-- 更新桌访问卷模板 v1 → v2
-- 新版 3 问 + 自适应收束框架：先服务、再聊天、后采集
-- 由 Jeremy 在线上 Supabase 执行

UPDATE lingtin_question_templates
SET
  template_name = '标准桌访问卷 v2',
  questions = '[
    {"id": "q1", "text": "菜都上齐了吧？今天点的这几道，有没有哪道让您印象特别深的？", "category": "菜品"},
    {"id": "q2", "text": "今天有没有什么小遗憾？哪怕很小的细节也想听听。", "category": "体验"},
    {"id": "q3", "text": "对了，您是老朋友还是第一次来呀？", "category": "画像"}
  ]'::jsonb,
  updated_at = NOW()
WHERE template_name = '标准桌访问卷';
