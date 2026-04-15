# 全栈架构地图

## 文档范围

本文描述 Fast-Note 仓库在前后端一体化后的目标结构与主要落点。目标根目录为：

- `backend`
- `fastnote`
- `docs`

需要处理 PocketBase Go 宿主、前端 FSD、同步链路或一体化打包时，优先按本文定位改动位置。

## 运行时基线

- 前端：Vue 3 + TypeScript + Ionic Vue + Vue Router + Vite
- 本地持久化：Dexie / IndexedDB
- 后端：Go + PocketBase
- 同步：PocketBase 客户端 + PocketBase Go 宿主
- 编辑器：Tiptap
- 核心策略：offline-first、本地优先、云端最终一致

## 目标根目录结构

### `backend`

职责：

- PocketBase Go 应用入口
- 自定义路由
- 事件钩子
- 迁移脚本
- 一体化静态资源服务

推荐结构：

```text
backend/
  main.go
  internal/
    server/
      bootstrap/
      hooks/
      routes/
  migrations/
  go.mod
  go.sum
```

### `fastnote`

职责：

- 前端 FSD 主体代码
- 构建配置
- 测试
- Tauri 资源

推荐结构：

```text
fastnote/
  src/
  public/
  tests/
  src-tauri/
  package.json
  vite.config.ts
  .env
  .env.production
```

### `docs`

职责：

- 架构文档
- 开发规划
- 产品与开发说明

## 前端 FSD 地图

### `fastnote/src/app`

职责：

- 应用启动
- provider 注册
- 路由装配
- 应用级初始化

### `fastnote/src/processes`

职责：

- 跨页面、长生命周期业务流程
- 会话初始化
- 同步编排
- 公开笔记初始化
- 导航恢复

### `fastnote/src/pages`

职责：

- 路由页容器
- 页面级装配
- 路由参数适配

### `fastnote/src/widgets`

职责：

- 多个 feature/entity 组合的业务 UI 模块

### `fastnote/src/features`

职责：

- 面向用户动作的应用用例
- 命令、查询、状态协同

### `fastnote/src/entities`

职责：

- 业务实体
- 实体状态
- 规则封装
- 实体级查询与组合

### `fastnote/src/shared`

职责：

- 通用 UI
- 工具
- 配置
- PocketBase/Dexie 等基础设施适配器
- 通用类型

## 后端结构地图

### `backend/main.go`

职责：

- 创建 `pocketbase.New()`
- 注册 migrations
- 注册 bootstrap 与 hooks
- 启动应用

### `backend/internal/server/bootstrap`

职责：

- 静态资源挂载
- 配置加载
- 启动期初始化

### `backend/internal/server/routes`（可选）

职责：

- 自定义业务接口
- 补充 PocketBase 标准 API 之外的后端能力

说明：

- 当前仓库并不存在该目录
- 只有在明确需要自定义服务端接口时才新增

### `backend/internal/server/hooks`

职责：

- PocketBase 事件钩子
- 服务端校验
- 派生字段维护
- 后端一致性兜底

### `backend/migrations`

职责：

- collection schema
- 索引
- 规则
- 默认设置
- 一次性修复

## 主要数据流

### 前端本地编辑流

1. `pages` 或 `widgets` 接收用户输入。
2. 调用 `features/note-editor`、`features/note-save` 等用例接口。
3. `entities` 更新本地状态。
4. `shared/lib/storage` 写入本地持久化。
5. `shared/api/pocketbase` 负责远端同步请求。

### 云端同步流

1. `fastnote/src/processes/sync-notes` 读取身份与同步状态。
2. 读取本地增量。
3. 经 `fastnote/src/shared/api/pocketbase` 写入或拉取远端。
4. 若服务端存在补充逻辑，由 `backend/internal/server/hooks` 或可选 `routes` 接管。
5. 同步结果回写本地状态。

### 一体化部署流

1. `fastnote` 执行前端构建生成 `dist`。
2. `backend` 在启动时挂载静态资源。
3. PocketBase 提供标准 API、realtime、文件服务和管理后台。
4. 自定义后端能力通过 `hooks` 或可选 `routes` 扩展。

## 依赖方向

### 前端依赖方向

- `app` -> `processes` -> `pages`/`widgets`/`features` -> `entities` -> `shared`

补充规则：

- `pages` 可以依赖 `widgets`、`features`、`entities`、`shared`
- `widgets` 可以依赖 `features`、`entities`、`shared`
- `features` 可以依赖 `entities`、`shared`
- `entities` 只能依赖 `shared`
- `shared` 不依赖业务层

### 前后端依赖方向

- `fastnote` 通过 HTTP、realtime、文件接口依赖 `backend`
- `backend` 不依赖 `fastnote/src` 业务代码
- `docs` 不参与运行时依赖，只承担说明与决策沉淀

## 高频变更热点

### 前端

- `fastnote/src/processes/session/*`
- `fastnote/src/processes/sync-notes/*`
- `fastnote/src/processes/public-notes/*`
- `fastnote/src/entities/note/model/state/*`
- `fastnote/src/shared/lib/storage/*`
- `fastnote/src/shared/api/pocketbase/*`
- `fastnote/src/pages/note-detail/ui/*`
- `fastnote/src/widgets/editor/ui/*`

### 后端

- `backend/main.go`
- `backend/internal/server/bootstrap/*`
- `backend/internal/server/routes/*`（仅在需要自定义接口时）
- `backend/internal/server/hooks/*`
- `backend/migrations/*`

## 使用原则

- 前端新增逻辑优先按 FSD 归位，不为“领域抽象”额外制造层级。
- 后端正式 schema 与服务端规则优先进入 `migrations` 与 `hooks`，不依赖后台手工配置。
- 涉及前后端一体化时，同时检查 `fastnote` 构建配置与 `backend` 启动方式。
- 若仓库实际目录尚未完全迁移到目标结构，先核对现状，再按目标结构报告差距，不要混淆当前路径和目标路径。
