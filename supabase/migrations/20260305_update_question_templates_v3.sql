-- 更新桌访问卷模板 v2 → v3
-- 4 问：口语化话术 + 新增来源追踪(q4)

UPDATE lingtin_question_templates
SET
  template_name = '标准桌访问卷 v3',
  questions = '[
    {"id": "q1", "text": "菜还合口味吧？有没有哪道觉得不错的？", "category": "菜品"},
    {"id": "q2", "text": "还满意吗？有没有哪里还需要我们改进的？", "category": "体验"},
    {"id": "q3", "text": "请问是第一次来吗？", "category": "频次"},
    {"id": "q4", "text": "方便问一下是从哪里知道我们的吗？", "category": "来源"}
  ]'::jsonb,
  updated_at = NOW()
WHERE template_name = '标准桌访问卷 v2';
