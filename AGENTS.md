# Repository Guidelines

## 项目结构与模块组织

仓库采用前后端一体结构。`fastnote/` 是 Vue 3、Framework7、Vite 前端，源码位于 `src/`，按 FSD 分为 `app`、`processes`、`pages`、`widgets`、`features`、`entities`、`shared`；Vitest 单元与集成测试位于 `tests/unit/`、`tests/integration/`，Cypress 用例位于 `tests/e2e/`。`backend/` 是 PocketBase Go 宿主：入口为 `main.go`，启动逻辑、路由和钩子在 `internal/server/`，集合结构与索引变更放入 `migrations/`。设计和研发文档统一放在 `docs/`。

保持 FSD 依赖向下：页面负责装配，用户动作进入 `features`，业务模型进入 `entities`，基础设施进入 `shared`。页面和组件不要直接调用 Dexie 或 PocketBase SDK。项目坚持 offline-first，本地状态是即时真相源，云端同步负责最终一致性。

## 构建、测试与本地开发

优先在仓库根目录执行：

- `npm run dev`：同时启动前端与 Go 后端；前端默认监听 `8888`。
- `npm run dev:frontend` / `npm run dev:backend`：单独启动一侧。
- `npm run lint`：运行前端 ESLint。
- `npm run test:unit -- --run`：运行全部 Vitest 测试一次。
- `npm run test:e2e`：运行 Cypress 端到端测试。
- `npm run build`：构建前端、同步静态资源并编译后端。
- `cd backend && go test ./...`：运行 Go 测试。

## 代码风格与命名

TypeScript/Vue 使用 2 空格缩进、单引号、无分号、100 字符行宽；以根目录 ESLint 和 `fastnote/.prettierrc.json` 为准。Vue 组件使用 `kebab-case.vue`，组合式函数以 `use-*.ts` 命名，测试命名为 `*.spec.ts`。Go 代码必须经过 `gofmt`。不要为跨层复用绕过 FSD 公共入口或新增无必要的抽象层。

## 测试准则

同步、存储、编辑器、路由和公开笔记属于高风险链路，行为变更必须补回归测试。先运行相关 spec，再执行完整 Vitest、lint 和 build；涉及用户流程时补 Cypress 用例。测试应描述可观察行为，并使用 `tests/fixtures/`、`tests/factories/` 与既有 mock，避免依赖真实账号或线上服务。

## 提交与 Pull Request

提交历史采用 Conventional Commits，例如 `feat(global-search): ...`、`fix(desktop): ...`、`refactor: ...`、`test(mobile): ...`。每个提交聚焦单一目的。PR 需说明行为变化、影响目录、验证命令和遗留风险，并关联 issue 或需求文档；UI 变更附桌面与移动端截图。

## 安全与配置

从 `.env.example` 创建本地配置，不提交密钥、真实账号、`pb_data/` 或构建产物。PocketBase 地址应使用同源或环境变量配置，禁止写死线上域名；迁移或发布前备份运行期 `pb_data/`。
