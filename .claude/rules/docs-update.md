# 文档更新规则

## 版本号更新规范

### 谁是"用户"

店长、厨师长、管理员（admin）都算用户。管理端页面改动**需要**更新版本号。

### 何时更新

- 用户说"提交"时，如果这批改动包含用户可见变化 → 更新版本号
- 同一 session 内多个 commit 属于同一功能 → 只在最后一个 commit 更新
- 纯后端 / 内部脚本 / cron 变更 → 不更新

### 语义化版本

- **patch** (2.4.x → 2.4.y): bug 修复、小优化、文案调整
- **minor** (2.x.0): 新功能、新页面、新角色能力
- **major** (x.0.0): 大改版、破坏性变更

### 判断清单

| 改动类型 | 更新版本？ | 版本级别 |
|---------|-----------|---------|
| 店长/厨师长端 UI 新功能 | 是 | minor |
| 管理端 UI 新功能 | 是 | minor |
| 任何角色 UI bug 修复 | 是 | patch |
| UI 样式/文案微调 | 是 | patch |
| PWA 图标/启动画面 | 是 | patch |
| 纯后端 API 新增 | 否 | — |
| 后端 bug 修复 | 否 | — |
| Cron / 定时任务 | 否 | — |
| DB 迁移 | 否 | — |
| 内部管理脚本 | 否 | — |
| 文档/README | 否 | — |

### 需要更新的文件（4 处）

1. `apps/web/components/layout/UpdatePrompt.tsx` — 递增 `APP_VERSION` + 更新 `BUILD_DATE`
2. `apps/web/public/version.json` — 同步更新 `version` 字段（网络版本检测依赖此文件，不同步则触发无限刷新）
3. `CHANGELOG.md` — 对应版本区块记录变更（Added / Changed / Fixed / Removed）
4. `apps/web/lib/release-notes.ts` — 添加对应版本条目（`WhatsNewModal` 弹窗 + 使用指南红点依赖此文件，缺失则弹窗不显示）

### 强制保障：pre-commit hook

hook 检测 `apps/web/(app|components)/**/*.tsx` 和 `apps/web/public/` 下的静态资源变更。有前端改动但未更新 `UpdatePrompt.tsx` 时拦截 commit。纯后端改动可用 `--no-verify` 跳过。

## 产品使用指南同步更新

用户可见功能迭代后同步更新（纯后端变更跳过）：

- `docs/user-guides/` 对应角色指南（按角色分文件：`store-manager.md`、`management.md`、`staff.md`、`chef.md`）
- `docs/PRODUCT-GUIDE.md`（综合使用指南 + 版本更新记录）
- 新增角色时需在 PRODUCT-GUIDE.md 中增加对应章节

## 产品指南更新触发规则

当用户说"更新产品指南使用说明"时：

1. 对比 `docs/PRODUCT-GUIDE.md` 头部版本号与 `CHANGELOG.md` 最新版本号
2. 从上次更新的版本开始，将后续迭代的功能变更同步到：
   - PRODUCT-GUIDE.md
   - `docs/user-guides/` 对应角色文件
   - README.md 版本号

## DATABASE.md 注意

`lingtin_visit_records` 实际含 `feedbacks JSONB` 列，但 DATABASE.md 未记录。修改 schema 前先查实际表结构。
