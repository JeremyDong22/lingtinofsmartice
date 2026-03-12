# Lingtin - 语音智能管理平台

## 产品定位

餐饮行业语音智能管理平台，以消费者反馈驱动管理闭环：**说了 → 记了 → 做了 → 验了**。当前阶段聚焦**店长单店闭环**（桌访录音 + AI 分析 + 行动建议）。

> 完整产品定义见 [docs/PRD.md](docs/PRD.md)，开发规范见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)，产品反馈与需求记录见 [docs/FEEDBACK-LOG.md](docs/FEEDBACK-LOG.md)。

## 技术栈

- **前端**: Next.js 14 + PWA + Tailwind CSS + SWR
- **后端**: NestJS (Node.js)
- **数据库**: Supabase (PostgreSQL)
- **AI**: DashScope Paraformer-v2 STT (讯飞回退) + DeepSeek Chat V3 (via OpenRouter)
- **存储**: Supabase Storage
- **认证**: Supabase Auth + JWT

## 项目结构

```
lingtin/
├── apps/
│   ├── web/                          # Next.js 前端 (@lingtin/web)
│   │   ├── app/
│   │   │   ├── (main)/              # 店长端 (recorder/, dashboard/, chat/)
│   │   │   ├── admin/               # 管理端
│   │   │   └── login/
│   │   ├── components/              # UI 组件 (recorder/, chat/, layout/)
│   │   ├── hooks/                   # useAudioRecorder, useRecordingStore, useMeetingStore, useChatStream
│   │   ├── contexts/                # AuthContext, SWRProvider
│   │   └── lib/                     # api.ts, backgroundProcessor.ts, supabase/
│   └── api/                          # NestJS 后端 (@lingtin/api)
│       └── src/
│           ├── modules/             # audio/, auth/, chat/, dashboard/, daily-summary/, meeting/, question-templates/, staff/
│           └── common/              # Supabase 客户端, 工具函数
├── packages/                         # 共享包
├── docs/                             # 产品 & 开发文档 (含 FEEDBACK-LOG.md 产品反馈与需求记录)
└── pnpm-workspace.yaml               # Monorepo 配置
```

## 常用命令

```bash
pnpm dev              # 同时启动前端 + 后端
pnpm dev:web          # 仅前端 (localhost:3000)
pnpm dev:api          # 仅后端 (localhost:3001)
pnpm build:web        # 构建前端
pnpm build:api        # 构建后端
# 注意: zsh 下路径含 (main) 等括号时必须加引号
# 注意: sw.js 是 PWA build 产物，改动前端后需 pnpm build:web 再提交
# 注意: rebase 时 sw.js 冲突直接接受任一版本，pnpm build:web 会重新生成
```

## 开发规范摘要

- **迭代开发，不是重构** — 渐进增强，不做大规模重写
- **TypeScript strict mode**，避免 `any`
- **文件名** kebab-case，**组件名** PascalCase
- **NestJS 模块**：module + controller + service 三件套
- **数据库表** `lingtin_` 前缀，UUID 主键，TIMESTAMPTZ 时间，启用 RLS
- **Git commit**：`feat|fix|docs|refactor(scope): description`
- **API 响应**：统一 `{ data, message }` 格式
- **认证 header**: 使用 `@/contexts/AuthContext` 导出的 `getAuthHeaders()`
- **Supabase UUID 查询**：所有 service 方法中 `restaurant_id` 必须做 UUID 校验，非法值回退 `DEFAULT_RESTAURANT_ID`
- **角色路由** — 新增角色改 3 处：`AuthContext.tsx`、`app/page.tsx`、新 layout。当前：`administrator`→`/admin/`、`manager`→`/recorder`、`head_chef`→`/chef/`
- **区域管理层** — `managed_restaurant_ids`：有值=区域管理层，NULL=总部。前端 `useManagedScope()`，API 用 `managed_ids` 过滤
- **面向店长的内容** — 站在店长角度讲价值，不暗示"被监控"
- **产品驱动设计** — 问题优先呈现 → 关键证据 → 可听原声 → 行动出口

> 详细规则见 `.claude/rules/` 目录：`stt-ai-pipeline.md`、`docs-update.md`、`workflow.md`、`tech-debt.md`、`external-services.md`

## 核心信息流

```
1. 预置: mt_dish_sales → lingtin_dishname_view (菜品字典)
2. 采集: 店长录音 + 桌号 → Supabase Storage → lingtin_visit_records
3. 处理: DashScope STT(讯飞回退) → 清洗 → 自动打标 → 画像提取 → visit_records
4. 展示: 看板(visit_records + table_sessions) / 问答(Text-to-SQL)
5. 行动: AI 负面反馈 → 改善建议(action_items) → 店长处理
```

## 数据库概览

核心表：`lingtin_visit_records`、`lingtin_table_sessions`、`lingtin_action_items`、`lingtin_meeting_records`、`lingtin_question_templates`、`lingtin_product_feedback`
只读引用：`master_restaurant`、`master_employee`、`master_region`、`mt_dish_sales`
视图：`lingtin_dishname_view`
废弃：`lingtin_dish_mentions`（v1.3.3 起全用 feedbacks JSONB）
新增字段（v2.1.0）：`customer_source VARCHAR(50)`、`visit_frequency VARCHAR(20)`（first/repeat/regular/unknown）

```
master_region (1)     ──< master_restaurant (N)
master_restaurant (1) ──< visit_records (N)
                      ──< action_items (N)
                      ──< table_sessions (N)
master_employee (1)   ──< visit_records (N)
                      ──> master_region (M:N via managed_region_ids[])
```

> 完整 schema 详见 [docs/DATABASE.md](docs/DATABASE.md)

## 部署概览

| 环境 | 平台 | 域名 |
|------|------|------|
| 前端 | Cloudflare Pages | https://lt.smartice.ai |
| 后端 | Zeabur（阿里云，计划迁移新加坡） | https://lingtinapi.preview.aliyun-zeabur.cn |

> 部署配置详见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)，工作流详见 `.claude/rules/workflow.md`
> 服务器迁移计划：后端将从阿里云迁移到新加坡区域

### Zeabur 项目信息

| 用途 | 项目名称 | 项目 ID |
|------|----------|---------|
| 后端 API | `lingtin-backend` | `697a5cfa06505fdd547f6889` |
| 前端 Web | `lingtin-frontend` | `69b2dddbd1eb012bec9f2b46` |

- 后端 Service ID: `697a6376f2339c9e766cb99d`，root: `/apps/api`，有 Dockerfile
- 前端 Service ID: `69b2de61d1eb012bec9f2b60`，root: `/`，Next.js 自动检测，构建命令: `pnpm --filter @lingtin/web build`，启动: `pnpm --filter @lingtin/web start`
- ⚠️ 根目录不能有 `Dockerfile`，否则 Zeabur 会误用 API Dockerfile 构建前端

### Zeabur CLI 使用规范

**⚠️ 重要：仅用于查看状态，禁止用于部署**

部署方式：**GitHub push 自动触发**，不要使用 `zeabur deploy` 命令（避免 context 混淆导致代码部署到错误项目）

**查看部署状态：**
```bash
# 1. 切换到正确的项目 context（必须）
zeabur context set project --id=697a5cfa06505fdd547f6889  # 后端
zeabur context set project --id=69b2dddbd1eb012bec9f2b46  # 前端

# 2. 查看当前 context（确认项目正确）
zeabur context get

# 3. 查看服务列表
zeabur service list

# 4. 查看部署日志
zeabur deployment list
zeabur deployment logs <deployment-id>
```

**禁止操作：**
- ❌ `zeabur deploy` — 使用 GitHub push 代替
- ❌ 不带 `--id` 的 context 切换 — 必须使用项目 ID

> 产品使用手册详见 [docs/user-guides/README.md](docs/user-guides/README.md)

## 上下文管理

- **读文件前先想清楚** — 只读与当前任务相关的文件
- **优先用 Grep/Glob** — 搜索定位后再精确读取
- **大文件用 offset/limit** — 超过 300 行的文件分段读取
- **长任务用 Task 子代理** — 探索、搜索、代码审查委托子代理
- **每次只改一个功能** — 不在一轮对话中处理多个不相关功能
- **回复保持简洁** — 给出关键信息即可，不要重复粘贴大段代码
- **每个版本完成后立即提交** — 不攒多个版本
- **提交前主动 compact** — 确保提交流程有足够上下文空间

## Compact Instructions

Preserve: current branch, modified files, build results, 进行中工作, git state.
Discard: old exploration outputs, historical context, large git diffs (use `--stat`).

## 进行中工作

> 此区块在 compact、结束 session、或完成阶段任务时更新。

| 任务 | 状态 | 关键笔记 |
|------|------|----------|
| 反馈自动闭环通知 | ✅ 完成 | PR #92/#93/#94 已合并部署。DB 字段 `reply_read_at`/`resolved_version`，API `auto-resolve`+`read-reply`，前端红点+Banner+Observer 自动已读。部署流程 Memory 已更新步骤 7 |
| 重跑缺 feedbacks 的记录 | ✅ 完成 | 2,395 条成功处理（5 条失败）。修复了 `reanalyzeBatch` 过滤器无限循环 bug（PR #121）：`feedbacks.eq.[]` 会重选已分析记录，改为仅 `feedbacks.is.null`。剩余 1,919 条 `feedbacks=[]` 是合法空结果（短录音/无有效反馈） |
| 重跑缺画像的记录 | 待评估 | `only_missing_profile: true` |
