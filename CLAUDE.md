# Lingtin - 智能桌访系统

## 项目概述

餐饮行业智能桌访管理系统，实现"店长零操作录音 + 老板自由问答"的核心体验。

## 技术栈

- **前端**: Next.js + PWA
- **后端**: Node.js (NestJS)
- **数据库**: Supabase (PostgreSQL)
- **AI**: 讯飞STT + Claude SDK
- **存储**: Supabase Storage

## 数据库设计

### 命名规范

- 所有新表使用 `lingtin_` 前缀
- 已有主数据表使用 `master_` 前缀
- 已有业务数据表使用 `mt_` 前缀

### 现有表（只读引用）

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `master_restaurant` | 餐厅主表 | id, restaurant_name, brand_id |
| `master_employee` | 员工表（含店长） | id, employee_name, restaurant_id, role_code |
| `mt_dish_sales` | 菜品销售数据 | 菜品名称, 销售数量, restaurant_id |

### Lingtin 核心表

#### lingtin_dishname_view (视图)

从 `mt_dish_sales` 提取去重菜品名称，用于STT语音纠偏。

```sql
-- 字段
dish_name TEXT      -- 标准菜品名称
aliases TEXT[]      -- 别名数组（预留扩展）
```

#### lingtin_visit_records (桌访录音表)

存储店长桌访的录音及AI处理结果。

```sql
-- 核心字段
id UUID PRIMARY KEY
restaurant_id UUID              -- 关联餐厅
employee_id UUID                -- 执行桌访的店长
table_id VARCHAR(10)            -- 桌号：B4, A12
audio_url TEXT                  -- 音频文件URL

-- STT处理结果
raw_transcript TEXT             -- 讯飞STT原始转写
corrected_transcript TEXT       -- 纠偏后文本

-- AI自动打标
visit_type VARCHAR(20)          -- routine/complaint/promotion
sentiment_score DECIMAL(3,2)    -- 情绪：-1.00 到 1.00
service_stage VARCHAR(20)       -- ordering/serving/checkout
ai_summary TEXT                 -- AI简要总结

-- 时间维度
visit_date DATE
visit_period VARCHAR(10)        -- lunch/dinner
status VARCHAR(20)              -- pending/processing/completed/failed
```

#### lingtin_dish_mentions (菜品提及表)

记录桌访中提及的菜品及评价。

```sql
-- 核心字段
id UUID PRIMARY KEY
visit_id UUID                   -- 关联桌访记录
dish_name TEXT                  -- 菜品名称
sentiment VARCHAR(10)           -- positive/negative/neutral
feedback_text TEXT              -- 具体反馈：壳硬、偏咸
mention_count INTEGER           -- 提及次数
```

#### lingtin_table_sessions (开台数据表)

记录每日开台情况，用于计算桌访覆盖率。

```sql
-- 核心字段
id UUID PRIMARY KEY
restaurant_id UUID
session_date DATE
period VARCHAR(10)              -- lunch/dinner
table_id VARCHAR(10)
open_time TIMESTAMPTZ
close_time TIMESTAMPTZ
guest_count INTEGER
source VARCHAR(20)              -- manual/pos_sync/excel_import
```

### 表关系图

```
master_restaurant (1)
    │
    ├──< lingtin_visit_records (N)
    │       │
    │       └──< lingtin_dish_mentions (N)
    │
    └──< lingtin_table_sessions (N)

master_employee (1)
    │
    └──< lingtin_visit_records (N)

lingtin_dishname_view
    │
    └── (语义关联) lingtin_dish_mentions.dish_name
```

## 核心信息流

```
1. 预置阶段
   mt_dish_sales → lingtin_dishname_view (菜品字典)

2. 采集阶段
   店长录音 + 桌号 → Supabase Storage → lingtin_visit_records

3. 处理阶段 (AI Pipeline)
   讯飞STT → 纠偏(对照dishname_view) → 自动打标 → 更新visit_records
                                              → 写入dish_mentions

4. 展示阶段
   P2看板: 聚合查询 visit_records + table_sessions
   P3问答: Claude Text-to-SQL → 查询所有表
```

## 开发规范

- 所有表启用 RLS (Row Level Security)
- 使用 UUID 作为主键
- 时间字段使用 TIMESTAMPTZ
- 中文字段名仅在原有 mt_ 表中保留，新表使用英文
