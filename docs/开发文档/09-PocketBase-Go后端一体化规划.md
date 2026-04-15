# PocketBase Go 后端一体化规划

> 更新时间：2026-04-09
> 适用仓库：`/Users/yytest/Documents/projects/fast-note`
> 当前结论：新版一体化目录已落地，后端当前保持 PocketBase host-only，不包含任何业务后端代码

## 1. 背景与结论

本仓库原先是纯前端项目，前端直接通过 PocketBase JavaScript SDK 连接外部服务。当前已经完成新版一体化改造：

- 前端迁入根目录下的 `fastnote/`
- 后端新增根目录下的 `backend/`
- 后端采用 PocketBase 官方推荐的 Go 宿主方式
- 前端改为同源优先访问 PocketBase
- 已为后续 Go extend 预留标准落点

结论：

- 技术方案可行
- 当前仓库已经具备“前后端一体仓库 + PocketBase Go 宿主 + 可构建单主程序”的基础形态
- 当前后端刻意保持为 host-only 基线，不引入业务表、业务路由、业务钩子和业务迁移

## 2. 当前已落地状态

### 2.1 前端现状

前端代码已位于 `fastnote/`，继续使用 Vue 3 + Vite + Ionic，架构统一按 FSD 组织。

PocketBase 前端接入现状：

- `fastnote/src/shared/api/pocketbase/client.ts`
  - 优先读取 `VITE_POCKETBASE_URL`
  - 未显式配置时优先回落到浏览器当前同源
  - 最后回退到 `http://127.0.0.1:8090`
- `fastnote/vite.config.ts`
  - 开发态 `/api` 已代理到本地 `http://127.0.0.1:8090`
- `fastnote/.env`
  - 默认 `VITE_POCKETBASE_URL=http://127.0.0.1:8090`
- `fastnote/.env.production`
  - 不再固定远程 PocketBase 域名，生产环境默认走同源

### 2.2 后端现状

后端代码已位于 `backend/`，当前已经是一个可运行、可构建的 PocketBase Go 主程序：

- `backend/main.go`
  - 创建 `pocketbase.New()`
  - 注册 `migratecmd`
  - 注册 bootstrap
  - 注册 hooks
  - 启动应用
- `backend/internal/server/bootstrap/static.go`
  - 负责静态资源目录探测
  - 支持读取 `FASTNOTE_WEB_DIST`
  - 支持本地开发路径 `../fastnote/dist`
  - 支持可执行文件附近的 `pb_public` 与 `../fastnote/dist`
- `backend/internal/server/hooks/register.go`
  - 目前仅保留空的注册入口
- `backend/migrations/doc.go`
  - 目前仅保留迁移包落点

### 2.3 当前边界

当前后端不包含以下内容：

- 业务 collection 定义
- 业务 schema 迁移
- 自定义业务路由
- 事件钩子业务逻辑
- 服务端业务规则

这是刻意保持的基线，而不是遗漏。当前目标只是把 PocketBase 官方 Go 宿主能力收回仓库，并打通前后端一体化工程结构。

## 3. 当前目录结构

当前推荐且已落地的目录结构如下：

```text
fastnote/
  backend/
    main.go
    go.mod
    go.sum
    internal/
      server/
        bootstrap/
          static.go
        hooks/
          register.go
    migrations/
      doc.go
  fastnote/
    src/
    public/
    tests/
    src-tauri/
    package.json
    package-lock.json
    vite.config.ts
    tsconfig.json
    .env
    .env.production
  docs/
  skills/
```

职责说明：

- `backend/`
  - 只承载 PocketBase Go 宿主、静态资源接入、扩展入口和未来迁移能力
- `fastnote/`
  - 只承载前端页面、状态、组件、测试和 Tauri 壳
- `docs/`
  - 存放架构、开发、交付文档
- `skills/`
  - 存放仓库内的 Codex 技能说明

## 4. 当前运行与交付方式

### 4.1 本地开发

当前建议的本地开发方式是前后端分开启动：

1. 在 `backend/` 启动 PocketBase Go 宿主
2. 在 `fastnote/` 启动前端 Vite 开发服务
3. 前端通过 `/api` 代理或显式 `VITE_POCKETBASE_URL` 访问本地 PocketBase

这种方式适合开发调试，也保持了 PocketBase 官方推荐的 Go extend 工作流。

### 4.2 生产构建

当前方案支持以下交付形态：

1. 在 `fastnote/` 执行前端构建，产出 `dist/`
2. 在 `backend/` 构建 Go 主程序
3. 由 PocketBase 宿主直接对外提供：
   - 管理后台
   - 标准数据 API
   - realtime
   - 文件服务
   - 前端静态资源

### 4.3 关于“单可执行文件”

当前目标的准确表述应为：

**单个 Go 主程序二进制 + 独立运行时数据目录**

说明：

- 主程序可以是单个可执行文件
- PocketBase 运行时仍然需要 `pb_data/`
- SQLite、上传文件和运行时状态不应强行打进二进制本体

## 5. 与前端架构的关系

本次改造不是把后端混入前端分层，而是在仓库根目录增加独立宿主。

前端继续按 FSD 组织：

- `app`
- `processes`
- `features`
- `entities`
- `shared`

PocketBase 在前端中的定位仍然是基础设施适配层：

- `fastnote/src/shared/api/pocketbase`

Go 后端承担的是运行时宿主和扩展入口职责，不进入前端 FSD 分层。

## 6. 当前保留的 Go Extend 落点

虽然当前没有任何业务后端代码，但已经保留了官方推荐的扩展入口，后续可以按需启用：

- `backend/internal/server/hooks`
  - 未来用于事件钩子、服务端校验、派生字段维护
- `backend/migrations`
  - 未来用于 schema 版本化、环境重建和一次性修复
- `backend/internal/server/bootstrap`
  - 未来用于启动期配置、静态资源与服务装配

注意：

- 当前并没有 `backend/internal/server/routes`
- 只有在确实需要自定义服务端接口时，才建议新增该目录
- 在没有业务后端需求之前，不要为了“完整性”预先堆出业务空壳

## 7. 后续演进建议

当前基线已经足够支撑一体化仓库。后续只建议按真实需要继续演进。

### 7.1 如需后端业务能力

再逐步引入：

- `backend/internal/server/routes`
- `backend/internal/server/hooks` 中的实际逻辑
- `backend/migrations` 中的 schema 与数据迁移

适合下沉到 Go 的逻辑：

- 服务端可信校验
- 非前端可信的权限逻辑
- 需要统一治理的派生字段
- 启动期初始化逻辑
- 无法只靠客户端保证一致性的处理

### 7.2 如需环境可重建能力

再引入迁移管理，而不是现在就预设业务表。

适用场景：

- 需要从零恢复一套新环境
- 需要版本化管理 schema 变更
- 需要把初始化数据、索引、规则纳入代码审计

当前阶段不要求这些内容先落地。

### 7.3 如需桌面壳继续演进

`fastnote/src-tauri/` 当前仍保留在前端目录内，后续有两种选择：

- 继续把 Tauri 当成前端侧桌面壳
- 如果未来必须让 Tauri 与本地 PocketBase sidecar 深度编排，再单独设计生命周期和打包方案

当前不建议把 Tauri sidecar 复杂度提前引入。

## 8. 当前验收结果

截至本次调整，仓库已经满足以下条件：

1. 后端可通过 Go 代码直接启动 PocketBase 应用
2. 后端已纳入仓库，而不是依赖外部单独下载的 PocketBase 可执行文件
3. 前端默认可连本地 PocketBase，并支持同源优先
4. 后端已具备静态资源接入能力
5. 前后端已按 `backend/ + fastnote/` 的新版目录拆分
6. 已为未来 Go extend 和 migrations 保留标准入口

当前未纳入验收范围：

- 业务 schema 重建
- 业务路由
- 业务钩子
- 业务初始化数据

## 9. 实施原则

后续继续在这个仓库上开发时，遵循以下原则：

1. 不把后端业务代码提前做成空壳
2. 不为了“看起来完整”而预建业务 collection
3. 前端保持 FSD 单一分层表述
4. 后端新增能力必须有明确业务收益
5. 优先保持 PocketBase 官方推荐工作流，不做反向封装

## 10. 参考资料

以下资料为当前方案采用的主要官方依据：

- PocketBase Go Overview  
  https://pocketbase.io/docs/go-overview
- PocketBase Go Routing  
  https://pocketbase.io/docs/go-routing
- PocketBase Go Event Hooks  
  https://pocketbase.io/docs/go-event-hooks/
- PocketBase Migrations  
  https://pocketbase.io/docs/migrations
- PocketBase Going to production  
  https://pocketbase.io/docs/going-to-production
- PocketBase 官方仓库  
  https://github.com/pocketbase/pocketbase

补充说明：

- 截至 2026-04-09，PocketBase 官方仍明确支持将自身作为 Go 库嵌入自定义应用
- 当前仓库采用的正是这一条官方宿主路径
