# FSD + DDD 架构地图

## 文档范围

本文描述 Fast-Note 仓库（`/root/fast-note`）在 2026-03 的当前目标架构与主要落点。旧的 `components/core/utils/types/database/pocketbase/adapters` 兼容入口已从代码层下线，后续设计与重构应只基于当前目录结构推进。

## 运行时基线

- 技术栈：Vue 3 + TypeScript + Ionic Vue + Vue Router + Vite
- 本地持久化：Dexie / IndexedDB
- 云端同步：PocketBase 客户端与服务层
- 编辑器：基于 Tiptap 的富文本编辑
- 核心策略：offline-first，本地优先，云端最终一致

## 目标顶层结构

### `src/app`

职责：

- 应用启动、provider 注册、路由装配、全局初始化、跨切面配置

当前映射：

- `src/main.ts`
- `src/App.vue`
- `src/app/router/*`
- `src/app/bootstrap/*`
- `src/app/providers/*`

### `src/processes`

职责：

- 跨页面、长生命周期业务流程
- 会话初始化、同步编排、公开笔记初始化、导航恢复

当前映射：

- `src/processes/session/*`
- `src/processes/sync-notes/*`
- `src/processes/public-notes/*`
- `src/processes/navigation/*`
- `src/processes/app-bootstrap/*`

### `src/pages`

职责：

- 路由页容器，只做页面级装配和路由参数适配

当前映射：

- `src/pages/home/*`
- `src/pages/folder/*`
- `src/pages/note-detail/*`
- `src/pages/deleted/*`
- `src/pages/login/*`
- `src/pages/register/*`
- `src/pages/user-public-notes/*`

### `src/widgets`

职责：

- 多个 feature/entity 组合的业务 UI 片段

当前映射：

- `src/widgets/note-list/*`
- `src/widgets/editor/*`
- `src/widgets/note-more/*`
- `src/widgets/user-profile/*`
- `src/widgets/extension-renderer/*`
- `src/widgets/note-editor-toolbar/*`

### `src/features`

职责：

- 面向用户动作的应用用例
- 负责命令、查询、状态协同，不直接承载底层 SDK

当前映射：

- `src/features/note-editor/*`
- `src/features/note-save/*`
- `src/features/note-move/*`
- `src/features/note-lock/*`
- `src/features/note-delete/*`
- `src/features/note-detail-*/*`
- `src/features/theme-switch/*`
- `src/features/global-search/*`
- `src/features/public-note-share/*`

### `src/entities`

职责：

- 领域实体、聚合、值对象、领域服务、仓储端口、实体级状态模型

当前映射：

- `src/entities/note/*`
- `src/entities/public-note/*`
- `src/entities/auth/index.ts`
- `src/shared/types/*` 中的跨实体共享契约

### `src/shared`

职责：

- 通用 UI、工具、配置、基础设施适配器、跨领域库

当前映射：

- `src/shared/api/pocketbase/*`
- `src/shared/lib/storage/*`
- `src/shared/lib/auth/*`
- `src/shared/lib/realtime/*`
- `src/shared/lib/date/*`
- `src/shared/lib/error-handling/*`
- `src/shared/lib/editor/*`
- `src/shared/lib/*`
- `src/shared/types/*`
- `src/shared/ui/*`

补充说明：

- `src/css/*`、`src/theme/*` 仍是样式资源目录，可逐步并入 `app/styles` 或 `shared`
- `src/router/`、`src/hooks/`、`src/stores/` 当前仅剩空目录历史痕迹，不应再新增文件

## DDD 建模准则

### 限界上下文

- `note`：笔记、文件夹、层级关系、删除状态、锁定状态
- `public-note`：公开展示、按用户名隔离的数据集与读取模型
- `auth`：认证身份、登录态、凭证与用户缓存
- `sync`：同步水位、冲突策略、同步任务调度
- `editor`：编辑器状态、自动保存触发、扩展能力
- `navigation`：路由返回栈、桌面/移动分支导航恢复

### 代码组织建议

单个 slice 内优先采用下列结构：

- `model/domain`
  - 实体、值对象、领域服务、仓储端口、不变量
- `model/state`
  - 实体级视图状态或 store 包装
- `api`
  - DTO、mapper、仓储实现入口
- `ui`
  - 实体或 feature 自带 UI
- `lib`
  - slice 内部工具

规则：

- `domain` 只能依赖本 slice 的纯模型与 `shared` 中无业务语义的工具。
- `api` 负责将 Dexie、PocketBase 等实现适配到仓储端口。
- `ui` 只能消费公开 API，不直接 import `api` 的内部实现。

## 历史目录到当前归宿

- `src/components/*` -> `src/widgets/*` 或 `src/shared/ui/*`
- `src/core/*` -> `src/processes/session/*`、`src/shared/lib/auth/*`、`src/shared/lib/realtime/*`
- `src/utils/*` -> `src/shared/lib/*`
- `src/types/*` -> `src/shared/types/*`
- `src/database/*` -> `src/shared/lib/storage/*`
- `src/pocketbase/*` -> `src/shared/api/pocketbase/*`
- `src/adapters/pocketbase/*` -> `src/shared/api/pocketbase/*` 与 `src/processes/session/*`
- `src/views/*` -> `src/pages/*`
- `src/hooks/*` -> `src/processes/*`、`src/features/*`、`src/shared/lib/*`
- `src/stores/*` -> `src/entities/*/model/state/*`

## 启动序列约束

当前启动入口仍是 `src/main.ts`，必须保持以下语义不变：

1. 创建 Vue 应用并初始化 Ionic。
2. 安装路由。
3. 并行执行路由就绪、本地数据库初始化、笔记状态初始化。
4. 初始化失败时仍能兜底挂载，避免白屏。

迁移到 FSD 后，上述动作由 `app` 与 `processes` 组合完成，但不能改变这些时序契约。

## 主要数据流

### 本地编辑流

1. `pages` 或 `widgets` 接收用户输入。
2. 调用 `features/note-editor`、`features/note-save` 等用例接口。
3. feature 通过 `entities/note` 的聚合规则与仓储状态完成更新。
4. `shared/lib/storage` 与 `shared/api/pocketbase` 负责本地持久化与远端同步接口。

### 云端同步流

1. `processes/sync-notes` 读取身份与同步状态。
2. 通过 `entities/note` 仓储状态读取本地增量。
3. 经 `shared/api/pocketbase` 写入远端。
4. 拉取远端变化，经过 mapper 回写本地状态。

### 公开笔记流

1. `app/router` 识别 `/:username...` 路由。
2. `processes/public-notes` 初始化用户范围数据集。
3. 通过 `entities/public-note` 读取远端公开数据并写入本地投影。
4. `pages` 与 `widgets` 只消费只读投影与公开 API。

## 依赖方向

必须保持单向依赖：

- `app` -> `processes` -> `pages`/`widgets`/`features` -> `entities` -> `shared`

补充规则：

- `pages` 可以依赖 `widgets`、`features`、`entities`、`shared`
- `widgets` 可以依赖 `features`、`entities`、`shared`
- `features` 可以依赖 `entities`、`shared`
- `entities` 只能依赖 `shared`
- `shared` 不依赖业务层

任何反向依赖都视为架构违规。

## 高频变更热点

重构与设计时优先关注这些现状文件，它们通常是下一步拆分切入口：

- `src/processes/session/model/use-session-bootstrap.ts`
- `src/processes/sync-notes/model/use-sync-notes.ts`
- `src/processes/navigation/model/use-route-state-restore.ts`
- `src/entities/note/model/state/note-store.ts`
- `src/entities/public-note/model/state/public-note-store.ts`
- `src/shared/lib/storage/dexie.ts`
- `src/shared/types/index.ts`
- `src/pages/note-detail/ui/note-detail-page.vue`
- `src/widgets/editor/ui/yy-editor.vue`

这些文件不是所有逻辑的最终归宿，但它们是当前主链路的真实承载点。
