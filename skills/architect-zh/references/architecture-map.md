# FSD + DDD 架构地图

## 文档范围

本文描述 Fast-Note 仓库（`/root/fast-note`）的目标架构。目标不是否认现状目录，而是为后续功能设计、重构和代码评审提供统一落点与迁移方向。

## 运行时基线

- 技术栈：Vue 3 + TypeScript + Ionic Vue + Vue Router + Vite
- 本地持久化：Dexie / IndexedDB
- 云端同步：PocketBase 客户端与服务层
- 编辑器：基于 Tiptap 的富文本编辑
- 样式体系：Ionic CSS + UnoCSS + 项目 SCSS
- 核心策略：offline-first，本地优先，云端最终一致

## 目标顶层结构

### `src/app`

职责：

- 应用启动、provider 注册、路由装配、全局初始化、跨切面配置

当前映射：

- `src/main.ts`
- `src/App.vue`
- `src/router/*`

### `src/processes`

职责：

- 跨页面、长生命周期业务流程
- 启动初始化、同步编排、公开笔记初始化、导航恢复

当前映射候选：

- `src/hooks/useSync.ts`
- `src/hooks/useUserPublicNotesSync.ts`
- `src/hooks/useNavigationHistory.ts`
- `src/hooks/useSmartBackButton.ts`
- `src/hooks/useRouteStateRestore.ts`

### `src/pages`

职责：

- 路由页容器，只做页面级装配和路由参数适配

当前映射：

- `src/views/*`

### `src/widgets`

职责：

- 多个 feature/entity 组合的业务 UI 片段

当前映射候选：

- `src/components/NoteList.vue`
- `src/components/NoteListItem.vue`
- `src/components/YYEditor.vue`
- `src/components/NoteMove.vue`
- `src/components/NoteMore.vue`
- `src/components/UserProfile.vue`

### `src/features`

职责：

- 面向用户动作的应用用例
- 负责命令、查询、状态协同，不直接承载底层 SDK

建议切分：

- `features/note-editor`
- `features/note-save`
- `features/note-move`
- `features/note-lock`
- `features/auth`
- `features/theme-switch`
- `features/sync-trigger`

当前映射候选：

- `src/hooks/useEditor.ts`
- `src/hooks/useNoteFiles.ts`
- `src/hooks/useNoteLock.ts`
- `src/hooks/useAuth.ts`
- `src/hooks/useTheme.ts`
- `src/hooks/useRealtime.ts`

### `src/entities`

职责：

- 领域实体、聚合、值对象、领域服务、仓储端口、实体级状态模型

建议上下文：

- `entities/note`
- `entities/public-note`
- `entities/user`
- `entities/sync-state`

当前映射候选：

- `src/stores/notes.ts`
- `src/stores/publicNotes.ts`
- `src/types/index.ts`
- `src/core/auth-types.ts`
- `src/core/realtime-types.ts`

### `src/shared`

职责：

- 通用 UI、工具、配置、基础设施适配器、跨领域库

当前映射：

- `src/database/*`
- `src/pocketbase/*`
- `src/adapters/*`
- `src/utils/*`
- `src/css/*`
- `src/theme/*`
- `src/core/*` 中无明确业务语义的通用能力

## DDD 建模准则

### 限界上下文

- `note`：笔记、文件夹、层级关系、删除状态、锁定状态
- `public-note`：公开展示、按用户名隔离的数据集与读取模型
- `auth`：认证身份、登录态、凭证与用户缓存
- `sync`：同步水位、冲突策略、同步任务调度
- `editor`：编辑器状态、自动保存触发、扩展能力
- `navigation`：路由返回栈、桌面/移动分支导航恢复

### 聚合与模型建议

- `NoteAggregate`
  - 维护标题、内容、父子关系、删除状态、锁定状态、版本与更新时间
- `PublicNoteProjection`
  - 面向只读展示，不承载编辑能力
- `SyncCheckpoint`
  - 维护最后同步时间、水位、失败恢复策略
- `UserIdentity`
  - 维护登录身份、用户范围与权限边界

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

## 现状到目标架构映射

### 启动与路由

- `src/main.ts` -> `src/app/providers`、`src/app/bootstrap`
- `src/router/index.ts` -> `src/app/router`
- `src/router/routeManager.ts` -> `src/app/router/lib` 或 `src/processes/navigation`

### 页面与组件

- `src/views/*` -> `src/pages/*`
- `src/components` 中纯通用组件 -> `src/shared/ui`
- `src/components` 中承载业务组合的组件 -> `src/widgets/*`

### 领域与用例

- `src/stores/notes.ts` -> `src/entities/note/model/*` + `src/features/note-*`
- `src/stores/publicNotes.ts` -> `src/entities/public-note/model/*`
- `src/hooks/useEditor.ts` -> `src/features/note-editor/model`
- `src/hooks/useNoteLock.ts` -> `src/features/note-lock/model`
- `src/hooks/useAuth.ts` -> `src/features/auth/model`

### 流程与基础设施

- `src/hooks/useSync.ts` -> `src/processes/sync-notes`
- `src/hooks/useUserPublicNotesSync.ts` -> `src/processes/public-notes-sync`
- `src/database/*` -> `src/shared/lib/storage` 或各实体 `api` 中的本地仓储实现
- `src/pocketbase/*` -> `src/shared/api/pocketbase` 或各实体 `api` 中的远端仓储实现

## 启动序列约束

当前启动入口仍是 `src/main.ts`，必须保持以下语义不变：

1. 创建 Vue 应用并初始化 Ionic。
2. 安装路由。
3. 并行执行路由就绪、本地数据库初始化、笔记状态初始化。
4. 初始化失败时仍能兜底挂载，避免白屏。

迁移到 FSD 后，这些动作可以重组到 `app` 与 `processes`，但不能改变上述时序契约。

## 主要数据流

### 本地编辑流

1. `pages` 或 `widgets` 接收用户输入。
2. 调用 `features/note-editor` 或 `features/note-save` 的用例接口。
3. feature 通过 `entities/note` 的聚合规则与仓储端口完成状态更新。
4. 仓储实现把变化写入 Dexie，并驱动实体状态或投影视图更新。

### 云端同步流

1. `processes/sync-notes` 读取身份与同步状态。
2. 通过 `entities/note` 仓储端口读取本地增量。
3. 经远端适配器写入 PocketBase。
4. 拉取远端变化，经过 mapper 回写本地仓储与实体状态。
5. 更新 `SyncCheckpoint`。

### 公开笔记流

1. `app/router` 识别 `/:username...` 路由。
2. `processes/public-notes-sync` 初始化用户范围数据集。
3. 通过 `entities/public-note` 仓储端口读取远端公开数据并写入本地投影。
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

重构与设计时优先关注这些现状文件，它们通常是迁移切入口：

- `src/stores/notes.ts`
- `src/hooks/useSync.ts`
- `src/database/dexie.ts`
- `src/router/index.ts`
- `src/views/NoteDetail.vue`
- `src/types/index.ts`

这些文件不是长期归宿，而是向目标架构迁移时的核心拆分源头。
