# Fast-Note 架构地图

## 文档范围

本文描述 Fast-Note 仓库（`/root/fast-note`）当前架构，用于保证需求实现与重构遵循既有边界。

## 运行时基线

- 技术栈：Vue 3 + TypeScript + Ionic Vue + Vue Router + Vite
- 本地持久化：Dexie / IndexedDB
- 云端同步：PocketBase 客户端与服务层
- 编辑器：基于 Tiptap 的富文本编辑
- 样式体系：Ionic CSS + UnoCSS + 项目 SCSS

## 启动序列

`src/main.ts`

1. Create Vue app and install Ionic in iOS mode.
2. Install router.
3. Run async initialization in parallel:
   - `router.isReady()`
   - `initializeDatabase()` from `src/database/dexie.ts`
   - `initializeNotes()` from `src/stores/notes.ts`
4. Mount app after initialization (fallback mount on failure).

含义：

1. 创建 Vue 应用，Ionic 使用 iOS 模式。
2. 挂载路由。
3. 并行初始化路由、数据库、笔记状态。
4. 初始化完成后挂载；失败时兜底挂载避免白屏。

## 分层模块

### 1) 表现层

- `src/views/*`：路由页（`HomePage`、`FolderPage`、`NoteDetail`、认证页、公开页等）
- `src/components/*`：复用组件（`YYEditor`、列表项、菜单、弹窗等）

### 2) 交互编排层

- `src/hooks/*`：页面与领域流程编排（`useSync`、`useNoteFiles`、`useNavigationHistory`、`useSmartBackButton`、`useUserPublicNotesSync` 等）

### 3) 领域状态层

- `src/stores/notes.ts`：笔记/文件夹主状态、查询与更新 API、内存索引、Dexie 同步桥接
- `src/stores/publicNotes.ts`：按用户隔离的公开笔记状态与本地数据库

### 4) 持久化层

- `src/database/dexie.ts`：Dexie schema 与数据库初始化
- `src/database/sync.ts`：`useRefDBSync` 响应式到表同步能力

### 5) 云端集成层

- `src/pocketbase/client.ts`：PocketBase 客户端与错误映射
- `src/pocketbase/notes.ts`、`src/pocketbase/auth.ts` 等：接口封装
- `src/hooks/useSync.ts`：本地与云端双向同步编排

### 6) 路由层

- `src/router/index.ts`：路由表与守卫
- `src/router/routeManager.ts`：扩展路由注册/卸载

### 7) 共享契约层

- `src/types/index.ts`：`Note`、`TypedFile`、`NOTE_TYPE`、文件夹树等核心类型
- `src/utils/date.ts`：统一时间格式工具（ISO 时间把 `T` 替换为空格）

## 当前路由拓扑

来源 `src/router/index.ts`：

- `/` -> redirect `/home`
- `/home`
- `/n/:id`
- `/login`
- `/register`
- `/:username/f/:pathMatch(.*)*`
- `/:username/n/:noteId`
- `/:username`
- `/f/:pathMatch(.*)*`
- `/deleted`

守卫行为：

- 桌面端（`window.innerWidth >= 640`）访问 `/n/*`、`/f/*` 会重定向到 `/home`
- 用户公开路由会按用户名做一次初始化与同步（去重执行）

## 关键数据契约

`src/types/index.ts` 中 `Note` 的关键字段：

- Identity: `id: string`
- Structure: `item_type`, `parent_id`, `note_count`
- Content: `title`, `summary`, `content`, `files`
- Sync/versioning: `created`, `updated`, `version`
- State flags: `is_deleted`, `is_locked`, optional `is_public`, optional `user_id`

契约规则：

- 任何 `Note` 字段语义变化，都必须同步更新 types、Dexie schema、stores、sync 逻辑。

## 主要数据流

### 本地编辑流

1. `NoteDetail.vue` handles editor lifecycle and save trigger.
2. Calls store APIs from `useNote()` (`addNote` / `updateNote` / etc.).
3. `stores/notes.ts` mutates reactive state and indexes.
4. `useRefDBSync` in store persists changes to Dexie `notes` table.

含义：

1. `NoteDetail.vue` 负责编辑器生命周期和保存触发。
2. 通过 `useNote()` 调用 store API。
3. `stores/notes.ts` 更新响应式状态和索引。
4. `useRefDBSync` 将变化落到 Dexie `notes` 表。

### 云端同步流

1. `useSync().sync()` evaluates auth state.
2. Read local changed notes by `updated` watermark.
3. Upload/update cloud data via `notesService`.
4. Pull remote updates and upsert back into local store.
5. Persist updated sync watermark.

含义：

1. `useSync().sync()` 检查认证状态。
2. 依据 `updated` 水位读取本地变更。
3. 通过 `notesService` 上传/更新云端。
4. 拉取远端变化并回写本地 store。
5. 持久化同步水位。

### 公开用户笔记流

1. Route guard detects `/:username...` routes.
2. `initializeUserPublicNotes(username)` opens user-scoped Dexie DB.
3. `useUserPublicNotesSync(username).syncUserPublicNotes()` fetches remote public notes.
4. Public notes are stored in user-scoped state/DB.

含义：

1. 路由守卫识别 `/:username...` 路径。
2. `initializeUserPublicNotes(username)` 打开该用户的独立 Dexie 库。
3. `useUserPublicNotesSync(username)` 拉取公开笔记。
4. 数据写入该用户隔离的状态与数据库。

## 高频变更热点

重构时优先关注这些文件：

- `src/stores/notes.ts`
- `src/hooks/useSync.ts`
- `src/database/dexie.ts`
- `src/router/index.ts`
- `src/views/NoteDetail.vue`
- `src/types/index.ts`

这些热点文件通常互相耦合，改动一个往往至少要联动检查另一个。
