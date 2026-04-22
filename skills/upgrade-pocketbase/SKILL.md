---
name: upgrade-pocketbase
description: 升级 fastnote 仓库中的 PocketBase 版本，包括后端 Go 宿主依赖与前端 JavaScript SDK，并完成最新版本核验、兼容性检查、构建测试与按需提交。用于用户要求“升级 PocketBase 到最新版本”“同步 Go 和 npm 的 PocketBase 依赖”“核实最新 release 并升级”“提交仅包含 PocketBase 升级改动”时。
---

# 升级 PocketBase 版本

## 概述

按当前仓库的实际集成方式升级 PocketBase，不假设“最新版本”已知，不跳过验证，不把无关改动混入提交。

当前 fastnote 仓库同时存在两类 PocketBase 依赖：

- `backend/go.mod` 中的 `github.com/pocketbase/pocketbase`
- `fastnote/package.json` 中的 `pocketbase`

## 工作流

### 1. 建立上下文

先确认仓库里哪些位置接入了 PocketBase，并记录当前版本。

- 查看 `backend/go.mod`、`backend/go.sum`
- 查看 `fastnote/package.json`、`fastnote/package-lock.json`
- 搜索仓库中的 PocketBase 使用点：`rg -n "pocketbase|PocketBase" -S .`
- 如需判断兼容性风险，优先查看：
  - `backend/main.go`
  - `backend/internal/server/bootstrap`
  - `backend/internal/server/hooks`
  - `backend/migrations`
  - `fastnote/src/shared/api/pocketbase`

### 2. 核验最新版本

不要凭记忆判断“最新版本”，必须先查官方或注册表。

- 核验 Go 宿主最新版本：`cd backend && go list -m -json github.com/pocketbase/pocketbase@latest`
- 核验官方 release：`gh api repos/pocketbase/pocketbase/releases/latest`
- 核验前端 SDK 最新版本：`cd fastnote && npm view pocketbase version`

在最终汇报中写清：

- 当前版本
- 最新版本
- 查询日期
- 使用的来源

如果 GitHub 页面、Go 模块源、npm 注册表结果不一致，优先信任模块源和注册表；同时说明差异。

### 3. 升级后端 Go 依赖

只在仓库实际存在 Go 宿主集成时执行。

- 执行：`cd backend && go get github.com/pocketbase/pocketbase@vX.Y.Z`
- 执行：`cd backend && go mod tidy`

注意：

- 如果上游要求更高的 Go 版本，允许 `go.mod` 中的 `go` 指令一并提升，但必须在结果里明确说明
- 如果升级后编译失败，先检查 PocketBase 暴露 API、路由注册、hooks、migrations 是否有破坏性变化
- 不要为了“先编过”而回退用户已有改动

### 4. 升级前端 JavaScript SDK

只在仓库实际依赖 `pocketbase` npm 包时执行。

- 执行：`cd fastnote && npm install pocketbase@X.Y.Z`

如果前端没有直接依赖 PocketBase SDK，就不要强行添加。

### 5. 做兼容性检查

升级后先判断是否只需要锁文件与依赖版本变更，还是要补代码兼容。

重点检查：

- 后端初始化、启动、静态资源挂载是否仍可编译
- migrations 是否仍兼容当前 PocketBase `core` / `migrations` API
- 前端 `PocketBase` 客户端实例化与错误处理是否仍兼容
- 与 PocketBase 强绑定的测试是否需要更新

如果没有代码兼容改动，也要明确说明“本次升级仅涉及依赖和锁文件”。

### 6. 执行最小验证

至少执行以下验证；若某一侧不存在则跳过并说明原因。

- `cd backend && go build ./...`
- `cd backend && go test ./...`
- `cd fastnote && npx vitest run tests/unit/pocketbase/*.spec.ts tests/unit/hooks/useSync-user-scope.spec.ts`
- `cd fastnote && npm run build`

处理验证结果时遵守以下规则：

- 构建失败或测试失败：优先修复，再结束任务
- 构建成功但有 warning：可以交付，但要在结果里单独说明 warning 不属于本次升级引入，还是升级后新出现
- 某个命令无法执行：说明阻塞原因，不要假装已验证

### 7. 控制提交范围

如果用户要求提交版本，只提交 PocketBase 升级相关文件，不混入工作区里的无关改动。

典型暂存范围：

- `backend/go.mod`
- `backend/go.sum`
- `fastnote/package.json`
- `fastnote/package-lock.json`

典型提交命令：

- `git add backend/go.mod backend/go.sum fastnote/package.json fastnote/package-lock.json`
- `git commit -m "chore: upgrade pocketbase to latest"`

提交前先看 `git status --short`，确认未把用户已有文档或其他功能改动带进去。

### 8. 汇报结果

最终输出至少包含：

- Go 宿主从哪个版本升到哪个版本
- JS SDK 从哪个版本升到哪个版本
- 是否触发了 `go` 指令升级
- 是否需要代码兼容修改
- 已执行的验证命令及结果
- 是否创建了 commit，以及 commit hash
- 工作区里是否仍有未提交的无关改动

## 处理原则

- 优先使用主来源和官方来源，不要凭记忆回答“最新版本”
- 升级前先确认仓库是否同时存在 Go 与 npm 两套 PocketBase 依赖
- 尽量保持改动最小，先升级依赖，再根据编译和测试结果决定是否改代码
- 用户要求“提交一个版本”时，只提交升级相关文件
- 输出中使用明确版本号与具体日期，避免只写“今天”“最新”
