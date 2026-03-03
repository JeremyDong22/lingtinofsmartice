# 协作工作流与发布流程

## 本地开发

- `pnpm dev` → 同时启动前后端本地测试
- 本地后端使用 anon key 连接 Supabase（受 RLS 约束，非 mock mode）
- 前端 `.env.local` 中 `NEXT_PUBLIC_API_URL` 控制连接哪个后端（本地 `localhost:3001` 或线上）

## 数据库变更（自动执行）

SQL 迁移文件放 `supabase/migrations/`，同时通过 Supabase Management API 直接执行。

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/wdpeoyugsxqnpwwtkqsl/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "..."}'
```

**禁止告诉用户去 Dashboard 手动执行 SQL。**

## 外部服务操作

用户已授权直接操作 Supabase / Cloudflare / Zeabur。读不到 token 就**一次性向用户要齐**，不要说"没有权限"或"请手动操作"。

- Supabase: `$SUPABASE_ACCESS_TOKEN`，Management API
- Cloudflare: `$CLOUDFLARE_API_TOKEN`，`npx wrangler`
- Zeabur: `zeabur auth` 全局登录，直接用 CLI

## 发布流程

代码改动 → **`/simplify` 自动审查修复**（typo 级小修除外）→ 构建通过 → **提示用户 `pnpm dev` 本地测试** → 用户确认无误 → commit + push（push 后 Zeabur 后端 + Cloudflare 前端均自动部署）

**提交前必须等用户确认**，用户说"OK/没问题/可以提交"后才执行。

### `/simplify` 使用规范

- **触发时机**：功能开发或 bug 修复完成后、build 之前
- **跳过条件**：单行 typo 修复、纯文档变更、配置文件调整
- **可选聚焦**：`/simplify focus on code reuse`、`/simplify focus on efficiency`

## Git 协作

- **Remotes**: `origin` = jeremydong22（上游），`fork` = SmartIce-Ray（备份）
- **Push 策略**: 默认 push `origin`，SmartIce-Ray 已是 collaborator
- **创建 PR**: `gh pr create --repo jeremydong22/lingtinofsmartice --base main`
- **Force push（rebase 后）**: 先 `git fetch origin <branch>` 刷新 tracking info
