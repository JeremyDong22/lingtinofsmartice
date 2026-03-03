# 技术债追踪

> 目标：**稳定的 STT 转录服务** + **稳定的文本打标（AI 分析）服务**

## STT 转录层

| 优先级 | 债务 | 状态 |
|--------|------|------|
| ✅ | DashScope Paraformer-v2 未开通（每次 fallback 到讯飞） | 已解决：DashScope 已集成为主 STT，讯飞为 fallback |
| ✅ | STT 无健康检测（启动时不验证凭证） | 已解决（b05b39e）：新增 `/api/audio/stt-health` 诊断端点 |
| ✅ | 讯飞 11201/11203 license 失败 | 已修复（8d4e65b）：双 fallback |

## AI 分析层

| 优先级 | 债务 | 状态 |
|--------|------|------|
| 🟡 中 | AI 分析无 fallback（DeepSeek 挂了直接 error） | 待优化：可加 `qwen/qwen-turbo` 备用 |
| 🟡 中 | `saveResults` 写库失败不抛异常（PR #5 遗留） | 待修复 |
| 🟢 低 | 本地清洗规则硬编码 | 暂不处理 |

## 数据模型

| 优先级 | 债务 | 状态 |
|--------|------|------|
| 🟢 低 | `lingtin_dish_mentions` 表废弃（v1.3.3 起全用 feedbacks） | 已标记废弃 |

## 可观测性

| 优先级 | 债务 | 状态 |
|--------|------|------|
| 🟡 中 | 无告警机制（STT/AI 失败只能事后看日志） | 待优化 |

## 已知技术债（PR #5 审查）

新增代码应避免重复：① `saveResults` 写库失败不抛异常 ② `DailySummaryController` 缺 UUID 校验 ③ API 响应未统一 `{data, message}` ④ 前端 `onError` 未通知用户
