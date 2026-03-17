# FSD + DDD 变更操作手册

## 目的

将常见需求映射到 FSD + DDD 的正确落点与验证步骤，避免继续把新逻辑堆回旧的 `views/hooks/stores/database/pocketbase` 分层里。

## 1. 新增或修改 Note 字段

典型需求：

- “给笔记增加 `pinned` / `archived` / `tags` 字段”

改动顺序：

1. 更新 `entities/note/model/domain` 中的聚合、值对象和不变量。
2. 更新 `entities/note` 的仓储端口与读模型。
3. 更新本地仓储实现（Dexie schema、mapper、索引）。
4. 更新远端仓储实现（PocketBase DTO、mapper、payload）。
5. 更新相关 `features/note-*` 输入输出。
6. 最后更新 `widgets/pages` 的展示与交互。

若仍在旧目录过渡期，对应检查：

- `src/types/index.ts`
- `src/stores/notes.ts`
- `src/database/dexie.ts`
- `src/hooks/useSync.ts`
- `src/pocketbase/notes.ts`

最小验证：

- 新建/编辑笔记并写入新字段。
- 刷新后确认字段持久化。
- 执行一次同步，确认云端往返一致。

## 2. 修改保存或自动保存行为

典型需求：

- “调整自动保存触发策略或防抖行为”

改动顺序：

1. 在 `features/note-editor` 或 `features/note-save` 调整保存用例与触发策略。
2. 若节流、防抖是跨组件策略，沉到 `shared/lib` 或 feature 内部 `lib`。
3. 若影响同步水位或本地写入节奏，联查本地仓储与 `processes/sync-notes`。
4. 页面或编辑器 widget 只改事件接线，不写核心保存规则。

过渡期重点文件：

- `src/views/NoteDetail.vue`
- `src/components/YYEditor.vue`
- `src/database/sync.ts`
- `src/hooks/useEditor.ts`

最小验证：

- 快速连续编辑，观察保存频率和时机。
- 确认不会重复创建笔记。
- 刷新后内容不丢失。
- 同步后版本与更新时间语义正确。

## 3. 修改文件夹树或父子关系行为

典型需求：

- “调整文件夹结构行为” / “修复文件夹计数”

改动顺序：

1. 在 `entities/note` 里调整聚合规则、父子约束与计数语义。
2. 更新依赖这些规则的查询模型或投影。
3. 在 `features/note-move`、`features/note-list` 等用例里编排调用。
4. 最后检查列表 widget 和页面消费逻辑。

过渡期重点文件：

- `src/stores/notes.ts`
- `src/stores/publicNotes.ts`
- `src/components/NoteList.vue`
- `src/views/FolderPage.vue`

最小验证：

- 创建多级文件夹与笔记。
- 执行跨文件夹移动。
- 校验 `note_count`、列表渲染与筛选结果。

## 4. 修改路由规则

典型需求：

- “新增路由” / “修改桌面端路由行为”

改动顺序：

1. 修改 `src/app/router` 的路由表和守卫。
2. 若涉及长流程初始化，放到 `processes/navigation` 或 `processes/public-notes-sync`。
3. 路由名或参数变化时，统一更新页面入口和 feature API。
4. 确保页面只处理参数适配，不内嵌守卫规则。

过渡期重点文件：

- `src/router/index.ts`
- `src/hooks/useNavigationHistory.ts`
- `src/hooks/useSmartBackButton.ts`
- `src/hooks/useRouteStateRestore.ts`

最小验证：

- 桌面与移动端都能正常导航。
- 公开路由仍能按用户名单次初始化。
- 没有路由遮蔽或误匹配。

## 5. 修改同步策略或云端 API 契约

典型需求：

- “同步改为服务端优先” / “修改上传 payload”

改动顺序：

1. 先在 `entities/sync-state` 或相关实体仓储端口明确冲突策略与状态语义。
2. 再改 `processes/sync-notes` 的流程编排。
3. 最后改本地与远端仓储实现及 DTO mapper。
4. 若同步结果影响 UI，使用 feature 或 widget 暴露状态，不让页面直接依赖远端细节。

过渡期重点文件：

- `src/hooks/useSync.ts`
- `src/pocketbase/*.ts`
- `src/stores/notes.ts`
- `src/database/dexie.ts`

最小验证：

- 本地单边改动后同步。
- 远端单边改动后同步。
- 同一笔记本地与远端并发改动时，冲突结果符合预期。
- 失败后本地数据仍可继续编辑。

## 6. 修改公开笔记行为

典型需求：

- “调整公开用户笔记页逻辑”

改动顺序：

1. 在 `entities/public-note` 定义公开只读模型与查询语义。
2. 在 `processes/public-notes-sync` 调整初始化、同步和用户隔离逻辑。
3. 路由入口放在 `app/router`。
4. 页面和 widget 只消费公开投影与只读能力。

过渡期重点文件：

- `src/stores/publicNotes.ts`
- `src/hooks/useUserPublicNotesSync.ts`
- `src/router/index.ts`
- `src/views/UserPublicNotesPage.vue`
- `src/views/FolderPage.vue`
- `src/views/NoteDetail.vue`

最小验证：

- 访问 `/:username`、`/:username/f/...`、`/:username/n/...`。
- 刷新后确认用户隔离数据初始化正确。
- 公开上下文下不会暴露编辑能力。

## 7. 修改编辑器扩展或富文本能力

典型需求：

- “新增扩展” / “调整编辑器工具栏行为”

改动顺序：

1. 先区分是领域规则还是纯展示能力。
2. 领域相关规则放在 `features/note-editor`。
3. 扩展装配与编辑器基础设施放在 `widgets/editor` 或 `shared/lib/editor`。
4. 页面只负责挂载编辑器容器。

过渡期重点文件：

- `src/components/YYEditor.vue`
- `src/components/extensions/*`
- `src/hooks/useExtensions.ts`
- `src/hooks/useEditor.ts`

最小验证：

- 新扩展可正常输入、撤销、恢复。
- 自动保存与内容序列化不回归。
- 移动端与桌面端交互保持可用。

## 8. 任意改动收尾前必做

1. 确认新增逻辑是否进入目标层级，而不是继续堆回旧目录。
2. 确认领域规则没有散落到页面、路由或 adapter。
3. 确认 `Note` 契约、时间戳规范、公开路由语义未被意外破坏。
4. 按风险执行检查：`lint`、`test:unit`、`build`。
5. 按 FSD 层汇总影响面：`app`、`processes`、`pages/widgets`、`features`、`entities`、`shared`。

## 9. 质量门禁清单

1. 领域纯度：实体和不变量是否摆脱了 Vue、Dexie、PocketBase 直接依赖。
2. 依赖方向：是否出现 `shared` 反向依赖业务层，或页面直接依赖基础设施。
3. 用例清晰度：用户动作是否通过 feature/process 编排，而不是直接操作 store 或 SDK。
4. 一致性：时间格式、主键语义、删除语义、冲突策略是否统一。
5. 健壮性：失败场景可回退、可重试、可提示，不出现静默丢数据。
6. 可测试性：核心规则是否能通过单测或稳定的手动步骤验证。
7. 迁移友好性：当前改动是否为后续拆分提供过渡层，而不是制造新的历史包袱。
