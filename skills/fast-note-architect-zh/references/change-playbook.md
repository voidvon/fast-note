# Fast-Note 变更操作手册

## 目的

将常见需求映射到正确文件与验证步骤，减少跨层误改与回归风险。

## 1. 新增或修改 Note 字段

典型需求：
- “给笔记增加 `pinned` / `archived` / `tags` 字段”

改动触点：

1. 更新 `src/types/index.ts`（`Note` 契约）。
2. 更新 `src/database/dexie.ts` 的 schema（必要时包含版本与索引）。
3. 更新 `src/stores/notes.ts`，如涉及公开链路再更新 `src/stores/publicNotes.ts`。
4. 更新 `src/hooks/useSync.ts` 与 `src/pocketbase/notes.ts` 的 payload 处理。
5. 更新受影响的 `src/views/*`、`src/components/*`。

最小验证：

- 新建/编辑笔记并写入新字段。
- 刷新后确认字段持久化。
- 执行一次同步，确认云端往返一致。

## 2. 修改保存/自动保存行为

典型需求：
- “调整自动保存触发策略或防抖行为”

改动触点：

1. 更新 `src/views/NoteDetail.vue` 保存逻辑。
2. 若是全局持久化节奏变化，复核 `src/database/sync.ts` 的防抖行为。
3. 检查列表刷新与同步触发是否出现副作用。

最小验证：

- 快速连续编辑，观察保存频率和时机。
- 确认不会重复创建笔记。
- 刷新后内容不丢失。

## 3. 修改文件夹树或父子关系行为

典型需求：
- “调整文件夹结构行为” / “修复文件夹计数”

改动触点：

1. 更新 `src/stores/notes.ts` 的树结构/计数逻辑。
2. 如需行为一致，同步更新 `src/stores/publicNotes.ts`。
3. 验证文件夹与列表页 UI 消费逻辑。

最小验证：

- 创建多级文件夹与笔记。
- 执行跨文件夹移动。
- 校验 `note_count`、列表渲染与筛选结果。

## 4. 修改路由规则

典型需求：
- “新增路由” / “修改桌面端路由行为”

改动触点：

1. 修改 `src/router/index.ts` 的路由表和守卫。
2. 若路由名/参数变化，同步更新依赖方（如 `useSmartBackButton`、页面、跳转入口）。
3. 保证 `/:username...` 相关路由匹配顺序不被破坏。

最小验证：

- 桌面与移动端都能正常导航。
- 公开路由仍能按用户名单次初始化。
- 没有路由遮蔽或误匹配。

## 5. 修改同步策略或云端 API 契约

典型需求：
- “同步改为服务端优先” / “修改上传 payload”

改动触点：

1. `src/hooks/useSync.ts`（同步编排与冲突处理）。
2. `src/pocketbase/*.ts`（请求/响应契约）。
3. `src/stores/notes.ts`（回写落点）。
4. 若 payload 结构变化，同步更新类型与 schema。

最小验证：

- 本地单边改动后同步。
- 远端单边改动后同步。
- 同一笔记本地与远端并发改动的冲突场景。

## 6. 修改公开笔记行为

典型需求：
- “调整公开用户笔记页逻辑”

改动触点：

1. `src/stores/publicNotes.ts`（用户隔离状态与数据库）。
2. `src/hooks/useUserPublicNotesSync.ts`（拉取与同步逻辑）。
3. `src/router/index.ts`（入口与守卫行为）。
4. 公开页组件（`UserPublicNotesPage.vue`、`FolderPage.vue`、公开上下文的 `NoteDetail.vue`）。

最小验证：

- 访问 `/:username`、`/:username/f/...`、`/:username/n/...`。
- 刷新后确认用户隔离数据初始化正确。

## 7. 任意改动收尾前必做

1. 确认模块边界未被破坏。
2. 确认 `Note` 契约与时间戳规范未被破坏。
3. 按风险执行检查（`lint`、`test:unit`、`build`）。
4. 按层汇总影响面（UI、hooks、stores、DB、sync、routing）。

## 8. 质量门禁清单（健壮/低耦合/可演进）

1. 健壮性：失败场景可回退、可重试、可提示，不出现静默丢数据。
2. 低耦合：新增逻辑是否避免了 UI 直接依赖 API 或数据库细节。
3. 高内聚：同一职责是否集中在单层，不把编排和细节实现混在一起。
4. 一致性：时间格式、主键语义、删除语义、冲突策略是否统一。
5. 可测试性：核心分支是否可通过单测或可重复手动步骤验证。
6. 可观测性：关键流程是否有可定位日志与可读错误信息。
7. 可扩展性：未来新增字段/策略时，是否只需局部改动而非全局重写。
