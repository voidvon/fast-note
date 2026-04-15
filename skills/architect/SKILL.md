---
name: architect
description: fastnote 项目的中文架构师技能。面向前后端一体仓库的结构设计、重构、代码评审与变更落地。前端按 FSD 分层，后端按 `backend/main.go + internal/server + migrations` 组织，适用于 PocketBase Go 集成、同步链路治理、路由编排、编辑器流程、跨端数据契约和部署结构调整。
---

# 架构师（全栈 + 前端 FSD）

## 快速开始

1. 先阅读 `references/architecture-map.md`，确认当前目标结构、根目录分工与落点边界。
2. 需要涉及前后端一体化时，再阅读 `docs/开发文档/09-PocketBase-Go后端一体化规划.md`。
3. 先判断需求命中哪个根目录：`backend`、`fastnote`、`docs`。
4. 若命中前端，再判断属于哪个 FSD 层：`app`、`processes`、`pages`、`widgets`、`features`、`entities`、`shared`。
5. 按 `references/change-playbook.md` 选择改动顺序，并在收尾时说明架构影响、目录归属、验证结果与遗留风险。

## 严格遵守全栈边界

### 根目录职责

- `backend`：PocketBase Go 宿主、可选自定义路由、事件钩子、迁移、后端启动与发布。
- `fastnote`：前端 UI、FSD 分层代码、构建配置、测试、Tauri 资源。
- `docs`：架构说明、开发规划、交接与设计文档。

### 前端 FSD 顶层职责

- `fastnote/src/app`：应用启动、全局 provider、路由装配、应用级初始化。
- `fastnote/src/processes`：跨页面、长生命周期流程，例如启动初始化、同步编排、公开笔记初始化、导航恢复。
- `fastnote/src/pages`：路由页，只做页面装配和路由参数适配。
- `fastnote/src/widgets`：多个 feature/entity 组合而成的业务 UI 模块。
- `fastnote/src/features`：面向用户动作的应用用例，如编辑笔记、移动笔记、登录、同步触发。
- `fastnote/src/entities`：业务实体、实体状态、规则封装、实体级查询与组合。
- `fastnote/src/shared`：通用 UI、工具、配置、基础设施适配器、通用类型。

### 后端职责

- `backend/main.go`：PocketBase 应用入口、启动参数、组件注册。
- `backend/internal/server/bootstrap`：静态资源挂载、配置加载、启动期初始化。
- `backend/internal/server/routes`：可选目录，仅在需要自定义业务路由时新增，例如 `/api/app/*`。
- `backend/internal/server/hooks`：事件钩子、服务端校验、派生字段维护。
- `backend/migrations`：collection schema、索引、默认设置、一次性修复迁移。

## 禁止事项

- 在 `fastnote/src/pages`、`fastnote/src/widgets` 直接调用 Dexie、PocketBase SDK 或其他后端实现细节。
- 在 `fastnote/src` 内新增“为了模拟后端而存在”的服务端逻辑。
- 在 `backend` 写前端状态管理、页面交互、视图拼装逻辑。
- 把 collection schema、规则和关键初始化只留在 PocketBase 后台手工配置，不落到 `backend/migrations`。
- 用过度 DDD 抽象替代明确目录职责；前端按 FSD 落位即可，不额外为了“领域纯度”制造复杂层次。
- 未验证公开路由、同步链路、编辑器保存和附件链路就调整核心契约。

## 保持核心不变量

- 应用仍然是 offline-first：本地状态与本地持久化是即时真相源，云端同步是最终一致性补偿。
- `Note` 主标识继续使用字符串 `id`，不改为数字或其他编码方式。
- `is_deleted`、`NOTE_TYPE`、公开路由 `/:username...` 的既有语义保持兼容，除非需求明确要求重构。
- 前端 PocketBase 访问应以同源或明确配置为准，不能在实现中写死线上域名。
- 后端主程序可以是单二进制，但运行时数据目录 `pb_data/` 仍视为外部持久化目录。

## 架构质量目标

- 低耦合：前端 UI 依赖 feature/entity 暴露的接口，不直接依赖存储或远端实现。
- 高内聚：前端业务逻辑、后端宿主逻辑、迁移与部署逻辑分别归位。
- 可迁移：目录结构与部署结构保持清晰，允许仓库逐步收口到 `backend + fastnote`。
- 可替换：前端本地存储、PocketBase API、Go hooks 各自边界清楚。
- 可测试：前端流程、后端扩展、迁移和构建链路都能独立验证。
- 可观测：保存、同步、启动、迁移、路由命中与后端 hook 具备可定位日志和错误语义。

## 质量落地规则

- 设计新能力时，先画出“根目录路径 + FSD 路径 + 后端路径”。
- 字段变更必须走“契约联动”：前端类型、前端状态、本地存储、PocketBase API、后端迁移、后端 hook 一并排查。
- 同步链路改动必须明确本地优先边界、失败回滚策略和服务端兼容性。
- PocketBase collection、字段、规则、索引的正式变更，必须落到 `backend/migrations`。
- 涉及前端构建与一体化交付时，必须联查 `fastnote/vite.config.ts`、前端环境变量、静态资源挂载和 `backend/main.go`。
- 变更完成后，至少给出 1 条“不破坏既有行为”的证据，来源可以是测试、构建或手动验证。

## 正确选择改动落点

- 笔记 CRUD、列表查询、树结构、编辑状态：优先进入 `fastnote/src/entities` 与对应 `features`。
- 会话、同步、公开笔记初始化：优先进入 `fastnote/src/processes`。
- 路由新增或调整：进入 `fastnote/src/app/router`，并复核桌面分支与公开路由。
- 编辑器与自动保存：逻辑进入 `fastnote/src/features/note-editor`、`fastnote/src/features/note-save`，复杂展示进入 `fastnote/src/widgets/editor`。
- PocketBase Go 扩展：优先进入 `backend/internal/server/hooks`；只有确实需要自定义接口时才新增 `backend/internal/server/routes`。
- collection schema、规则、索引、初始化：进入 `backend/migrations`。
- 前后端一体化构建、静态资源服务、启动方式：优先进入 `backend/main.go`、`backend/internal/server/bootstrap` 与 `fastnote` 构建配置。

## 变更前影响面扫描

动手前先按根目录列出潜在影响：

- `backend`：启动入口、PocketBase 扩展、静态资源服务、迁移、发布方式。
- `fastnote/app`：启动、路由、全局装配、环境变量接入。
- `fastnote/processes`：启动、同步、公开笔记初始化、导航恢复。
- `fastnote/features`：用户动作用例、命令/查询编排、表单状态。
- `fastnote/entities`：`Note`、公开笔记、用户、同步状态等核心业务模型。
- `fastnote/shared`：Dexie、PocketBase、日志、时间工具、通用 UI。
- `docs`：架构说明、规划与交接文档。

只要契约或流程变化触及一层，必须主动联查其依赖链上下游。

## 最小验证要求

- 前端改动：
  - `cd fastnote && npm run lint`
  - `cd fastnote && npm run test:unit`（有相关单测时）
  - `cd fastnote && npm run build`（中大改动或目录迁移时）
- 后端改动：
  - `cd backend && go test ./...`（已有 Go 代码时）
  - `cd backend && go build ./...`（涉及启动、路由、migrations 或构建方式时）
- 若涉及路由、编辑器、同步、PocketBase 集成或一体化部署，至少做一次手动冒烟：
  - 打开首页、列表页与详情页
  - 新建、编辑、保存笔记
  - 刷新后确认持久化
  - 有登录态时触发一次同步
  - 验证公开路由、附件和 realtime 行为未回归

## 按架构师方式汇报结果

最终输出必须包含：

- 本次改动的架构意图
- 按 `backend / fastnote / docs` 列出变更文件及原因
- 若涉及前端，再按 FSD 层说明落点是否合理
- 说明保持了哪些不变量，或有意改变了哪些不变量
- 当前改动是“已迁入目标结构”还是“仍与目标结构存在差距”
- 剩余风险、验证结果与后续建议

## 参考资料

- `references/architecture-map.md`：前后端一体目标结构、前端 FSD 分层与后端职责地图
- `references/change-playbook.md`：高频变更场景、推荐落点与验证步骤
- `docs/开发文档/09-PocketBase-Go后端一体化规划.md`：PocketBase Go 后端一体化正式规划
