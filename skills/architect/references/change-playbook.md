# 全栈变更操作手册

## 目的

将常见需求映射到 fastnote 前后端一体结构下的正确落点与验证步骤，避免：

- 把前端逻辑塞进后端
- 把后端规则塞进前端
- 在前端为 DDD 抽象过度设计
- 只改代码不改 PocketBase migrations

## 1. 新增或修改 Note 字段

典型需求：

- “给笔记增加 `pinned` / `archived` / `tags` 字段”

改动顺序：

1. 更新 `fastnote/src/shared/types/index.ts` 中的核心契约。
2. 更新 `fastnote/src/entities/note` 中的实体状态、规则或查询逻辑。
3. 更新本地仓储实现：`fastnote/src/shared/lib/storage/*`。
4. 更新前端 PocketBase 适配：`fastnote/src/shared/api/pocketbase/notes.ts`。
5. 如果字段属于正式后端 schema，更新 `backend/migrations/*`。
6. 若存在服务端派生逻辑或一致性校验，更新 `backend/internal/server/hooks/*`。
7. 最后更新相关 `features`、`widgets`、`pages`。

当前重点检查：

- `fastnote/src/shared/types/index.ts`
- `fastnote/src/entities/note/*`
- `fastnote/src/shared/lib/storage/*`
- `fastnote/src/shared/api/pocketbase/notes.ts`
- `fastnote/src/processes/sync-notes/*`
- `backend/migrations/*`
- `backend/internal/server/hooks/*`

最小验证：

- 新建/编辑笔记并写入新字段。
- 刷新后确认字段持久化。
- 执行一次同步，确认云端往返一致。
- 若后端 schema 有变更，确认迁移可重复执行且不报错。

## 2. 修改保存或自动保存行为

典型需求：

- “调整自动保存触发策略或防抖行为”

改动顺序：

1. 在 `fastnote/src/features/note-editor` 或 `fastnote/src/features/note-save` 调整保存策略。
2. 若是跨组件策略，沉到 `fastnote/src/shared/lib` 或 feature 内部 `lib`。
3. 若影响同步节奏，联查 `fastnote/src/processes/sync-notes`。
4. 若需要后端幂等性、写入补偿或服务端兜底，再补 `backend/internal/server/hooks`。
5. 页面和 widget 只改事件接线，不写保存核心规则。

当前重点检查：

- `fastnote/src/features/note-editor/*`
- `fastnote/src/features/note-save/*`
- `fastnote/src/widgets/editor/ui/*`
- `fastnote/src/pages/note-detail/ui/*`
- `fastnote/src/processes/sync-notes/*`
- `backend/internal/server/hooks/*`

最小验证：

- 快速连续编辑，观察保存频率和时机。
- 确认不会重复创建笔记。
- 刷新后内容不丢失。
- 同步后版本与更新时间语义正确。

## 3. 修改文件夹树或父子关系行为

典型需求：

- “调整文件夹结构行为” / “修复文件夹计数”

改动顺序：

1. 更新 `fastnote/src/entities/note` 中的树结构、计数或父子约束逻辑。
2. 更新依赖这些规则的状态模型和查询结果。
3. 在 `fastnote/src/features/note-move` 等用例里编排调用。
4. 最后检查列表 widget 和页面消费逻辑。

当前重点检查：

- `fastnote/src/entities/note/model/domain/folder-tree.ts`
- `fastnote/src/entities/note/model/domain/note-rules.ts`
- `fastnote/src/entities/note/model/state/*`
- `fastnote/src/features/note-move/*`
- `fastnote/src/widgets/note-list/*`
- `fastnote/src/pages/folder/*`

最小验证：

- 创建多级文件夹与笔记。
- 执行跨文件夹移动。
- 校验 `note_count`、列表渲染与筛选结果。

## 4. 修改路由规则

典型需求：

- “新增路由” / “修改桌面端路由行为” / “修改公开路由”

改动顺序：

1. 修改 `fastnote/src/app/router/routes.ts` 的路由表。
2. 若涉及守卫或初始化，放到 `fastnote/src/app/router`、`fastnote/src/processes/navigation` 或 `fastnote/src/processes/public-notes`。
3. 路由名或参数变化时，统一更新页面入口和 feature API。
4. 确保页面只处理参数适配，不内嵌守卫规则。
5. 若影响后端静态资源回退或同源部署，再联查 `backend/main.go` 与 `backend/internal/server/bootstrap`。

当前重点检查：

- `fastnote/src/app/router/*`
- `fastnote/src/processes/navigation/*`
- `fastnote/src/processes/public-notes/*`
- `backend/main.go`
- `backend/internal/server/bootstrap/*`

最小验证：

- 桌面与移动端都能正常导航。
- 公开路由仍能按用户名单次初始化。
- 同源部署下没有路由遮蔽或静态资源误匹配。

## 5. 修改同步策略或云端 API 契约

典型需求：

- “同步改为服务端优先” / “修改上传 payload” / “增加服务端校验”

改动顺序：

1. 先明确前端本地优先边界和状态语义。
2. 再改 `fastnote/src/processes/sync-notes` 的流程编排。
3. 更新 `fastnote/src/shared/api/pocketbase/*` 的 DTO 或调用方式。
4. 若协议或规则属于服务端正式能力，补 `backend/internal/server/hooks`、`migrations`；只有需要自定义接口时才新增 `backend/internal/server/routes`。
5. 若同步结果影响 UI，用 feature 或 process 暴露状态，不让页面直接依赖远端细节。

当前重点检查：

- `fastnote/src/processes/sync-notes/*`
- `fastnote/src/shared/api/pocketbase/*`
- `fastnote/src/entities/note/model/state/*`
- `fastnote/src/shared/lib/storage/*`
- `backend/internal/server/hooks/*`
- `backend/migrations/*`

最小验证：

- 本地单边改动后同步。
- 远端单边改动后同步。
- 同一笔记本地与远端并发改动时，结果符合预期。
- 失败后本地数据仍可继续编辑。

## 6. 修改 PocketBase Go 后端宿主

典型需求：

- “新增自定义后端接口”
- “补服务端 hook”
- “把静态资源交给 PocketBase 提供”

改动顺序：

1. 启动与注册逻辑优先改 `backend/main.go`。
2. 事件钩子进入 `backend/internal/server/hooks/*`。
3. 只有确实需要自定义接口时才新增 `backend/internal/server/routes/*`。
4. 初始化和静态资源挂载进入 `backend/internal/server/bootstrap/*`。
5. schema 或系统设置正式变更进入 `backend/migrations/*`。

当前重点检查：

- `backend/main.go`
- `backend/internal/server/bootstrap/*`
- `backend/internal/server/hooks/*`
- `backend/migrations/*`

最小验证：

- `go build ./...` 能通过。
- 若新增了自定义路由，路由能命中。
- hooks 生效且不破坏标准 PocketBase 行为。
- migrations 能执行且可重复运行。

## 7. 修改前后端一体化构建与部署

典型需求：

- “前端构建产物改为后端托管”
- “默认改为同源 PocketBase”
- “调整可执行文件打包方式”

改动顺序：

1. 修改 `fastnote` 环境变量与 PocketBase base URL 解析。
2. 修改 `fastnote/vite.config.ts` 的构建与开发代理。
3. 修改 `backend` 静态资源挂载与 SPA fallback。
4. 若涉及桌面壳，再联查 `fastnote/src-tauri/*`。
5. 最后验证生产构建和本地运行方式是否一致。

当前重点检查：

- `fastnote/src/shared/api/pocketbase/client.ts`
- `fastnote/vite.config.ts`
- `fastnote/.env`
- `fastnote/.env.production`
- `backend/main.go`
- `backend/internal/server/bootstrap/*`
- `fastnote/src-tauri/*`

最小验证：

- 前端构建产物能被后端正确提供。
- 访问页面时同源 PocketBase 正常工作。
- 登录、笔记 CRUD、附件、公开笔记、realtime 基本链路可用。

## 8. 任意改动收尾前必做

1. 确认新增逻辑进入正确根目录。
2. 确认前端逻辑按 FSD 落位，没有额外堆出无意义抽象层。
3. 确认正式后端能力已同步进 `backend/migrations`、`routes` 或 `hooks`。
4. 确认 `Note` 契约、时间戳规范、公开路由语义未被意外破坏。
5. 按风险执行检查：前端 `lint/test/build`，后端 `go test/go build`。
6. 若涉及一体化交付，至少做一次手动冒烟。

## 9. 质量门禁清单

1. 前后端边界是否清楚，没有逻辑串层。
2. 前端是否保持 FSD 单向依赖，没有页面直接依赖基础设施内部实现。
3. 后端是否把正式 schema 和服务端规则纳入 migrations / hooks / routes。
4. 一致性：时间格式、主键语义、删除语义、同步策略是否统一。
5. 健壮性：失败场景可回退、可重试、可提示，不出现静默丢数据。
6. 可测试性：核心流程是否能通过自动化或稳定的手动步骤验证。
7. 部署友好性：改动是否收敛到 `backend + fastnote` 目标结构，而不是继续发散。
