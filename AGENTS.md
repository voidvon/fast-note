# Repository Guidelines

## 项目结构与模块

这是一个前端优先（offline-first）项目：客户端本地数据是即时真相源，云端同步负责最终一致性。用户的备忘录正文、标题、层级和同步所需元数据会在客户端完整保存并参与同步；附件实体只同步引用和元数据，文件 Blob 按需加载，图片打开备忘录时加载，其他附件在用户点击时加载，并缓存到 IndexedDB。`fastnote/` 是 Vue 3、Ionic、Vite 前端：业务代码在 `src/`，按 FSD 分为 `app`、`processes`、`features`、`entities`、`shared`；单测与集成测试在 `tests/unit/`、`tests/integration/`，Cypress 用例在 `tests/e2e/`。`backend/` 是 PocketBase Go 宿主，路由位于 `internal/server/routes/`，钩子位于 `hooks/`，迁移位于 `migrations/`。产品、架构和开发文档放在 `docs/`。

保持依赖方向：`features` 可依赖 `entities/shared`，`entities` 只能依赖 `shared`；页面和组件不得直接操作 Dexie 或 PocketBase SDK。修改同步逻辑时，不能把远程附件下载混入备忘录全量同步，也不能让远端状态覆盖未完成的本地编辑。

## 构建、测试与开发

在 `fastnote/` 中执行：

- `npm run dev`：启动 Vite，本地默认端口为 8888。
- `npm run build`：执行 `vue-tsc` 后构建生产产物。
- `npm run test:unit -- --run`：运行全部 Vitest 单测和集成测试。
- `npm run lint`：执行 ESLint；提交前至少对改动文件运行精确范围 lint。
- `npm run test:e2e`：运行 Cypress 端到端测试。

在 `backend/` 中执行 `go test ./...` 和 `go build ./...`。前端开发通常还需单独启动本地 PocketBase 后端；不要在代码中写死线上地址。

## 代码风格

TypeScript 使用 2 空格缩进、单引号和无分号风格，遵循现有 ESLint 配置。Vue 组件使用 `kebab-case.vue`，组合式函数以 `use` 开头，测试文件使用 `*.spec.ts`。颜色样式优先复用 `fastnote/src/css/var.scss` 中的 token；使用颜色变量时禁止在 `var()` 中提供兜底颜色，缺少 token 时应先在 `var.scss` 中补齐浅色和深色定义。Go 使用 `gofmt`；新增正式集合字段或索引必须放入 `backend/migrations/`。

## 测试与提交

为同步、存储、编辑器和公开页改动补充回归测试；先运行相关 spec，再运行完整测试和构建。提交历史采用 Conventional Commit 风格，例如 `feat(attachments): ...`、`fix(desktop): ...`、`refactor(public-note): ...`。PR 应说明行为变化、验证命令和风险；UI 变更附截图，关联对应 issue 或需求文档。不要提交 `pb_data/`、构建产物、密钥或真实账号信息。
