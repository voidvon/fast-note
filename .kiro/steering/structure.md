# 项目结构

## 当前目标结构

仓库按前后端一体方式组织：

```text
backend/
  main.go
  internal/
    server/
      bootstrap/
      hooks/
  migrations/

fastnote/
  src/
  public/
  tests/
  src-tauri/
  package.json
  vite.config.ts

docs/
skills/
```

## 根目录职责

### `backend/`

- PocketBase Go 宿主入口
- 静态资源挂载
- 事件钩子
- migrations

说明：

- 当前只保留宿主能力
- 还没有业务 routes、业务 schema、业务 migrations

### `fastnote/`

- 前端应用主体
- 前端构建配置
- 自动化测试
- Tauri 资源

### `docs/`

- 开发规划
- 架构说明
- 产品与交接文档

## 前端结构

前端按 FSD 组织：

```text
fastnote/src/
  app/
  processes/
  pages/
  widgets/
  features/
  entities/
  shared/
```

### FSD 约束

- `app`：应用启动、全局 provider、路由装配
- `processes`：长生命周期流程，如同步、会话、导航恢复
- `pages`：路由页装配
- `widgets`：业务 UI 模块
- `features`：用户动作用例
- `entities`：实体状态、规则、查询组合
- `shared`：工具、适配器、类型、通用 UI

## 后端结构

### `backend/main.go`

- 创建并启动 PocketBase
- 注册 migrations
- 注册 bootstrap
- 注册 hooks

### `backend/internal/server/bootstrap`

- 负责前端静态资源目录挂载
- 为后续一体化部署保留宿主入口

### `backend/internal/server/hooks`

- 为后续服务端钩子预留目录
- 当前不承载业务逻辑

### `backend/migrations`

- 为后续 PocketBase schema 和设置变更预留目录
- 当前不承载业务 schema

## 关键原则

1. 不把后端逻辑写进 `fastnote/src`
2. 不把前端状态和 UI 逻辑写进 `backend`
3. 前端只通过 PocketBase SDK 访问后端
4. 正式的服务端 schema、规则、初始化变更必须进入 `backend/migrations`
5. 当前阶段后端是宿主层，不主动新增业务表和业务接口
