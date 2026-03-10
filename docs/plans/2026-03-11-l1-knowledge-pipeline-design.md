# L1 知识提取管线设计

## 目标

从 7,344 条历史录音数据中提取 L1 知识，灌入 `lingtin_knowledge_store`，驱动蒸馏管线运转，形成"越用越准"的正反馈循环。

## 核心原则

**数据质量优先**：先校对、再提取、再蒸馏。校对后的数据回写数据库。

## 管线流程

```
Step 1: 抽样转录精校（50条/店 × 8店 = 400条）
  → AI 精校 corrected_transcript
  → 提取 STT 错误模式 → L1 rule（如"碗豆尖→豌豆尖"）
  → 提取方言/口语规律 → L1 rule（如"还可以=正面评价"）

Step 2: 规律注入知识库
  → 写入 knowledge_store（auto_approve: true，因为是系统提取）
  → enrichPrompt 立即可用

Step 3: 全量重分析（5,043 条有效记录）
  → enrichPrompt 注入精校规律
  → 重新分析 → 回写 corrected_transcript + feedbacks + ai_summary
  → 同时提取门店画像/模式 → L1 profile + pattern + benchmark

Step 4: 触发蒸馏
  → L1 → L2(纵向) → L3(横向) → L4(行动)
```

## 实现

### 新增文件

`apps/api/src/modules/knowledge/knowledge-bootstrap.service.ts`

### Controller 端点

`POST /api/knowledge/worker/bootstrap` — 触发完整回填（hr901027 only）

### 预估

- 抽样精校 ~400 次 AI 调用
- 全量重分析 ~5,000 次 AI 调用
- 提取知识 ~50 次 AI 调用
- 总成本 < ¥30，耗时 2-3 小时
- 产出：~120 条 L1 → ~30 条 L2/L3 → ~10 条 L4
