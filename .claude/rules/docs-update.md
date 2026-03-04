---
paths:
  - "docs/**"
  - "CHANGELOG.md"
  - "apps/web/components/layout/UpdatePrompt.tsx"
---
# 文档更新规则

## 版本号更新（每次迭代必做）

1. `apps/web/components/layout/UpdatePrompt.tsx` — 递增 `APP_VERSION` + 更新 `BUILD_DATE`
2. `CHANGELOG.md` — 对应版本区块记录变更（Added / Changed / Fixed / Removed）

## 产品使用指南同步更新

**仅用户可见功能**迭代后同步更新（内部管理工具、纯后端变更跳过）：

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
