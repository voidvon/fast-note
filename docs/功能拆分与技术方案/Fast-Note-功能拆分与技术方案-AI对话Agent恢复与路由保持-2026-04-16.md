# AI 对话 Agent 恢复与路由保持技术方案（Fast-Note）

## 1. 文档信息

- 模块名称：AI 对话 Agent 恢复与路由保持
- 输出日期：2026-04-16
- 输出文件：`docs/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-AI对话Agent恢复与路由保持-2026-04-16.md`
- 对应总览：`docs/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-总览-AI对话Agent能力-2026-04-16.md`
- 模块范围：
  - 刷新恢复策略
  - PC 深链接保持
  - 待确认与执行中任务的恢复差异
- 不在范围：
  - 多页面协同
  - 服务端会话恢复

## 2. 模块目标与现状

- 业务目标：
  - 保证 `/n/<noteId>`、`/f/...` 在 PC 端打开、刷新、AI 会话恢复后仍保持原路由；待确认可继续，执行中不自动重跑。
- 当前状态（已支持/部分支持/未支持）：部分支持
- 关键证据：
  - `E1` [fastnote/src/pages/home/ui/home-page.vue:258]：PC 当前通过原生 `history.pushState/replaceState` 更新 URL。
  - `E2` [fastnote/src/pages/home/ui/home-page.vue:306]：桌面端已支持根据当前路径同步选中对象。
  - `E3` [fastnote/src/pages/home/ui/home-page.vue:485]：`init()` 已按当前路径优先恢复桌面对象。
  - `E4` [fastnote/src/processes/navigation/model/use-desktop-active-note.ts:151]：桌面端已有标准笔记/文件夹路由生成。
  - `E5` [fastnote/src/processes/ai-chat-session/model/use-ai-chat-session.ts:138]：当前仅持久化 `pendingExecution + lastResults`。
  - `E6` [fastnote/src/widgets/note-detail-pane/ui/note-detail-pane.vue:306]：移动端草稿转正式对象已直接原生替换 URL。
- 已知缺口：
  - 执行中任务刷新后没有恢复语义。
  - AI 会话恢复和路由恢复仍是分离逻辑。
  - 缺少任务与当前路由对象的一致性校验。

## 3. 逐功能点方案

### 3.1 F4.1 待确认与执行中任务的恢复策略

#### 3.1.1 目标与边界

- 用户场景：
  - 刷新后，待确认任务还能确认；执行中任务变成待继续，不自动重放。
- 范围内：
  - 任务恢复分类。
- 范围外：
  - 自动后台继续执行。

#### 3.1.2 现状证据

- 代码事实：
  - `E5` [fastnote/src/processes/ai-chat-session/model/use-ai-chat-session.ts:148]：当前只存 `pendingExecution` 与 `lastResults`。
  - `E7` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:295]：清空会话会同时清除确认态和消息。
  - `E8` [fastnote/src/features/ai-chat/ui/ai-chat-panel.vue:229]：待确认 UI 当前可直接复用。
- 现状结论：
  - 待确认恢复已具备基础，但执行中恢复完全缺位。
- 推断与待确认：
  - [推断] 需要把“执行中最后一步”和“恢复入口”作为任务数据一部分持久化。

#### 3.1.3 技术方案

- 方案摘要：
  - 恢复策略明确分为：
    - `waiting_confirmation`：原样恢复
    - `executing/identifying/reading`：恢复为 `interrupted`
    - `completed/failed/cancelled`：仅恢复结果
- 架构落点（按层）：
  - UI（`views/components`）：
    - 中断态展示“继续任务”。
  - 编排（`hooks`）：
    - `hydrateTaskState()` 将执行中任务转换为 `interrupted`。
  - 领域（`stores`）：
    - 新增 `restoredFromInterrupted` 标志。
  - 持久化（`database`）：
    - 扩展 `ai-chat-agent-task` 存储最近任务帧。
  - 云端（`pocketbase`）：
    - 无改动。
  - 路由（`router`）：
    - 恢复前验证当前路由是否仍匹配任务对象。
- 数据契约变更：
  - 字段/类型：
    - `restoredStatus`
    - `lastSafeStep`
  - 兼容与迁移：
    - 旧数据缺失时不恢复任务。
- 同步与冲突策略：
  - 恢复不自动重放写操作。
- 错误处理与回滚策略：
  - 恢复失败则只保留聊天消息，不显示继续入口。

#### 3.1.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T1 | 扩展任务持久化模型支持 `interrupted` 恢复 | `fastnote/src/features/ai-chat/model/*` | Agent 状态机 | 中 |
| T2 | `hydrateTaskState()` 实现恢复分类 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts` | T1 | 中 |
| T3 | 面板展示待继续入口 | `fastnote/src/features/ai-chat/ui/ai-chat-panel.vue` | T2 | 低 |

#### 3.1.5 验收标准

- AC1：待确认任务刷新后仍可确认/取消。
- AC2：执行中任务刷新后恢复为 `已中断/待继续`。
- AC3：恢复后不自动重复提交写操作。

#### 3.1.6 测试与验证

- 单元测试：
  - `hydrateTaskState()` 对不同原状态的恢复结果。
- 集成/冒烟：
  - 刷新待确认任务和执行中任务各一遍。
- 回归关注点：
  - 现有 `pendingExecution` 恢复能力不受影响。

#### 3.1.7 风险与未决问题

- 风险：
  - 若最后一步是读取步骤，恢复后继续任务可能重复请求模型。
- 未决问题：
  - 是否要提示“继续任务可能重新读取一次数据”。

### 3.2 F4.2 PC 深链接与 Agent 上下文一致性

#### 3.2.1 目标与边界

- 用户场景：
  - 从 `/n/<noteId>` 打开 AI，对话恢复后路由不能回到 `/home`，也不能跳到移动端页面。
- 范围内：
  - PC 深链接保持。
  - AI 与桌面对象选中态同步。
- 范围外：
  - 重写桌面页整体导航。

#### 3.2.2 现状证据

- 代码事实：
  - `E1` [fastnote/src/pages/home/ui/home-page.vue:258]：PC 已通过原生 history 更新 URL，避免 Ionic 路由动画。
  - `E2` [fastnote/src/pages/home/ui/home-page.vue:306]：桌面端可从 `/n/`、`/f/` 当前路径恢复选择状态。
  - `E3` [fastnote/src/pages/home/ui/home-page.vue:533]：AI 结果卡片打开对象时，桌面端走内部 URL 更新，移动端走 `router.push`。
  - `E4` [fastnote/src/processes/navigation/model/use-desktop-active-note.ts:151]：桌面端路由生成已统一。
- 现状结论：
  - 路由保持基础已具备，但 AI 恢复逻辑没有挂到这条链路上。
- 推断与待确认：
  - [推断] Agent 恢复时必须复用桌面端已有 `desktopRouteState`，不能再单独维护一套对象路径。

#### 3.2.3 技术方案

- 方案摘要：
  - 任务恢复时始终以当前桌面路由为主键校验对象一致性，AI 只消费、不同步覆盖该路由。
- 架构落点（按层）：
  - UI（`views/components`）：
    - 无新增大 UI，仅在对象失配时显示“当前页面对象已变化”。
  - 编排（`hooks`）：
    - `useAiChat()` 新增 `routeTargetSnapshot`，恢复时与当前对象比对。
  - 领域（`stores`）：
    - 复用 `useDesktopActiveNote()` 与当前 `state.noteId/state.folderId`。
  - 持久化（`database`）：
    - 任务存储对象关联字段：`noteId/folderId/routePath`。
  - 云端（`pocketbase`）：
    - 无改动。
  - 路由（`router`）：
    - PC 继续使用原生 history。
    - 移动端继续沿用现有 `router.push/replace`。
- 数据契约变更：
  - 字段/类型：
    - `routeTargetSnapshot`
  - 兼容与迁移：
    - 无。
- 同步与冲突策略：
  - 如当前路由对象与恢复任务对象不一致，恢复为“需重新定位”。
- 错误处理与回滚策略：
  - 对象已失效时不强制跳转，只展示失配信息。

#### 3.2.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T4 | 为任务增加 `routeTargetSnapshot` | `fastnote/src/features/ai-chat/model/*` | T1 | 低 |
| T5 | 恢复时接入桌面端当前对象校验 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts`, `fastnote/src/pages/home/ui/home-page.vue` | T4 | 中 |
| T6 | 增加深链接恢复回归测试 | `fastnote/tests/integration/global-search/*`, `fastnote/tests/*navigation*` | T5 | 中 |

#### 3.2.5 验收标准

- AC1：PC 端 `/n/<noteId>` 刷新后仍保持原地址。
- AC2：AI 恢复不将页面重置为 `/home`。
- AC3：对象失配时提示重新定位，而不是跳移动端页面或静默覆盖。

#### 3.2.6 测试与验证

- 单元测试：
  - 路由对象与任务对象匹配/失配时的恢复结果。
- 集成/冒烟：
  - PC 深链接 + AI 恢复 + 打开卡片跳转。
- 回归关注点：
  - 不得重新引入 Ionic 路由动画副作用。

#### 3.2.7 风险与未决问题

- 风险：
  - Home 页面初始化与 AI 恢复同时运行时，存在一次性覆盖风险。
- 未决问题：
  - 是否需要把 `overlayMode=ai` 也纳入任务快照。

## 4. 附录：模块证据索引

| 证据ID | 代码位置 | 摘要 |
| ------ | -------- | ---- |
| E1 | `fastnote/src/pages/home/ui/home-page.vue:258` | PC 通过原生 history 更新 URL |
| E2 | `fastnote/src/pages/home/ui/home-page.vue:306` | 桌面端可从当前路由恢复对象 |
| E3 | `fastnote/src/pages/home/ui/home-page.vue:533` | AI 卡片打开对象时桌面/移动分流 |
| E4 | `fastnote/src/processes/navigation/model/use-desktop-active-note.ts:151` | 桌面端标准对象路由 |
| E5 | `fastnote/src/processes/ai-chat-session/model/use-ai-chat-session.ts:138` | 当前只持久化待确认和最近结果 |
| E6 | `fastnote/src/widgets/note-detail-pane/ui/note-detail-pane.vue:306` | 移动端草稿转正式对象时原生替换 URL |
| E7 | `fastnote/src/pages/home/ui/home-page.vue:485` | Home 初始化当前已优先按路由恢复 |
