---
paths:
  - "apps/api/src/modules/audio/**"
  - "apps/api/src/modules/chat/**"
  - "apps/api/src/modules/daily-summary/**"
  - "apps/api/src/modules/meeting/**"
---
# STT & AI 模型配置

## STT 处理流水线

```
STT(DashScope→讯飞) → 本地清洗(硬编码规则，去语气词) → AI 分析(DeepSeek) → 存库
```

三步独立，任一步失败不影响已完成步骤。`audio_url` 始终保留可重跑。

## STT 回退模式

- **DashScope Paraformer-v2** → **讯飞方言大模型** → **讯飞中文识别大模型**
- `extractTranscript` 失败必须抛异常（不能返回空串），否则回退不触发
- 讯飞收到非零 code 时若已有部分结果则 resolve 而非 reject（防止 11203 丢弃已转写内容）

## DashScope API

- 提交: `/api/v1/services/audio/asr/transcription`
- 轮询: `/api/v1/tasks/{id}`（路径不同！）
- `transcription_url` 是预签名 OSS URL，不需要 Authorization header

## AI 分析模型

- **模型**: OpenRouter → DeepSeek V3（`deepseek/deepseek-chat-v3-0324`），无 fallback
- **汇报模式**: `stream: true` 真流式（`streamBriefingResponse()`）
- **普通聊天**: 非流式 + agentic tool loop（`callClaudeAPI()`）
- **AI JSON 解析**: 必须 try-catch 包裹 `JSON.parse`，catch 中记录原始内容前 200 字

## AI 汇报稳定性三要素

1. `temperature: 0` 消除随机性
2. 服务端预查询数据注入 prompt（不让 AI 自己决定 SQL）
3. 去掉 tools 参数（不走 agentic tool-calling loop）

架构: `prefetchBriefingData()` + `streamResponse()` briefing 分支
