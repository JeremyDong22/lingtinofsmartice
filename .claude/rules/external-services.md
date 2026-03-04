---
paths:
  - "apps/api/src/modules/audio/**"
  - "apps/api/src/modules/chat/**"
---
# 外部服务文档

## API 文档

| 服务 | 文档链接 | 说明 |
|------|----------|------|
| 讯飞方言大模型 | https://www.xfyun.cn/doc/spark/spark_slm_iat.html | STT 语音识别，202 种方言 |
| 讯飞控制台 | https://console.xfyun.cn/ | API 密钥管理 |
| DashScope | https://help.aliyun.com/zh/model-studio/paraformer-recorded-speech-recognition-restful-api | Paraformer-v2 录音识别 |
| DashScope 控制台 | https://dashscope.console.aliyun.com/ | API Key 管理 |
| Hume AI Expression Measurement | https://dev.hume.ai/docs/expression-measurement/overview | 语音情绪识别 API（48 维情绪） |
| Hume AI 定价 | https://www.hume.ai/pricing | 按量付费 |

## 语音情绪识别调研（2026-02，尚未集成）

| 服务 | 情绪粒度 | 单价 | 评估 |
|------|----------|------|------|
| **Hume AI** | 48 维 | $0.0639/min | **最佳** — 直接分析音频 |
| AssemblyAI | 3 级 | $0.02/小时 | 粒度太粗 |
| emotion2vec | 开源 | 免费 | 需 GPU 运维 |

**Lingtin 成本估算**（基于 3,923 条真实数据）：
- 单条录音平均 40 秒，单条成本 ¥0.30
- 单店月费 ¥410~770，全 8 店 ~¥2,750/月
