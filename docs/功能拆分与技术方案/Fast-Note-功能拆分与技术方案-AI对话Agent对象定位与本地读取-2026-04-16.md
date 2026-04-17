# AI 对话 Agent 对象定位与本地读取技术方案（Fast-Note）

## 1. 文档信息

- 模块名称：AI 对话 Agent 对象定位与本地读取
- 输出日期：2026-04-16
- 输出文件：`docs/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-AI对话Agent对象定位与本地读取-2026-04-16.md`
- 对应总览：`docs/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-总览-AI对话Agent能力-2026-04-16.md`
- 模块范围：
  - URL/当前页面/候选结果对象定位
  - 本地优先读取
  - 与登录启动/同步链路的解耦
- 不在范围：
  - 全量向量检索
  - 云端知识库

## 2. 模块目标与现状

- 业务目标：
  - 用户直接给 `/n/<noteId>` 或在当前页面发起任务时，Agent 立即基于本地对象工作，不等待远端认证刷新。
- 当前状态（已支持/部分支持/未支持）：部分支持
- 关键证据：
  - `E1` [fastnote/src/features/global-search/ui/global-search.vue:148]：当前已经注入 `activeNote/activeFolder/candidateNotes/recentNotes`。
  - `E2` [fastnote/src/features/ai-chat/model/request-context.ts:139]：上下文会被转成 system prompt。
  - `E3` [fastnote/src/features/ai-chat/model/openai-compatible-chat-transport.ts:65]：提示词已约束 `/n/<noteId>` 链接解析。
  - `E4` [fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:300]：`get_note_detail` 直接走 `getNote()` 读取本地对象。
  - `E5` [fastnote/src/entities/note/model/state/note-store.ts:131]：`getNote()` 已基于索引从本地 notes 读取。
  - `E6` [fastnote/src/processes/session/model/use-session-bootstrap.ts:118]：登录会话启动当前仍串行同步，存在阻塞风险。
- 已知缺口：
  - 对象来源优先级没有统一策略。
  - 缺少“本地未就绪/缓存有值/远端在刷”的显式状态。

## 3. 逐功能点方案

### 3.1 F2.1 对象定位优先级

#### 3.1.1 目标与边界

- 用户场景：
  - 用户输入一个 fastnote 链接，Agent 应优先定位该对象，而不是先模糊搜索。
- 范围内：
  - 统一对象定位优先级。
- 范围外：
  - 多对象批量命中。

#### 3.1.2 现状证据

- 代码事实：
  - `E1` [fastnote/src/features/global-search/ui/global-search.vue:149]：当前已有活动对象和候选对象上下文。
  - `E2` [fastnote/src/features/ai-chat/model/openai-compatible-chat-transport.ts:65]：提示词已引导模型从 URL 提取 noteId。
  - `E3` [fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:274]：搜索与详情读取均已有本地工具。
- 现状结论：
  - 当前对象定位能力已具备基础件，但规则散落在 prompt 与上下文注入中。
- 推断与待确认：
  - [推断] 需要在前端增加显式的 `resolveAgentTarget()`，而不是完全依赖模型自行决策。

#### 3.1.3 技术方案

- 方案摘要：
  - 增加前端对象定位优先级：`显式 URL > 当前活动对象 > 当前候选对象 > 本地搜索结果 > 用户补充确认`。
- 架构落点（按层）：
  - UI（`views/components`）：
    - 无新增主要 UI，仅在对象不唯一时显示候选提示卡。
  - 编排（`hooks`）：
    - 新增 `resolveAgentTarget(request, requestContext)`。
  - 领域（`stores`）：
    - 复用 note store 的 `getNote()`、`searchNotesInDatabase()`、`getFolderTreeByParentId()`。
  - 持久化（`database`）：
    - 无改动。
  - 云端（`pocketbase`）：
    - 无改动。
  - 路由（`router`）：
    - 读取当前 `route.path` 与对象 id 作为辅助输入。
- 数据契约变更：
  - 字段/类型：
    - `AiAgentTargetResolution`
  - 兼容与迁移：
    - 无。
- 同步与冲突策略：
  - 仅定位，不触发同步。
- 错误处理与回滚策略：
  - 定位不到时返回结构化候选列表或要求补充信息。

#### 3.1.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T1 | 定义 `AiAgentTargetResolution` 与优先级规则 | `fastnote/src/features/ai-chat/model/*` | 无 | 低 |
| T2 | 在 `useAiChat()` 发送前做显式对象定位预处理 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts` | T1 | 中 |
| T3 | 对象歧义时渲染候选提示卡 | `fastnote/src/features/ai-chat/ui/*` | T2 | 中 |

#### 3.1.5 验收标准

- AC1：消息含 `/n/<noteId>` 时直接命中该笔记。
- AC2：当前活动笔记存在且用户说“这条笔记”时可直接命中。
- AC3：对象不唯一时不执行写入。

#### 3.1.6 测试与验证

- 单元测试：
  - `resolveAgentTarget()` 对 URL、活动对象、候选对象三种命中优先级。
- 集成/冒烟：
  - 粘贴本地链接后直接读取并继续处理。
- 回归关注点：
  - 普通搜索模式不应被 Agent 预处理污染。

#### 3.1.7 风险与未决问题

- 风险：
  - 前端预解析若和模型判断不一致，可能导致目标冲突。
- 未决问题：
  - 是否允许对象定位阶段主动触发一次本地搜索。

### 3.2 F2.2 本地优先读取与启动链路解耦

#### 3.2.1 目标与边界

- 用户场景：
  - 直接打开 `/n/<noteId>` 时，页面和 Agent 不应黑屏等待 `auth-refresh` 或同步完成。
- 范围内：
  - 明确 local-first 读取顺序。
  - 执行中不强依赖远端刷新。
- 范围外：
  - 完整重写登录启动链路。

#### 3.2.2 现状证据

- 代码事实：
  - `E4` [fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:301]：详情读取当前就是本地 `getNote()`。
  - `E5` [fastnote/src/entities/note/model/state/note-store.ts:131]：本地读取当前为索引 O(1) 查找。
  - `E6` [fastnote/src/processes/session/model/use-session-bootstrap.ts:118]：登录启动会串行 `prepareSessionContext -> realtime -> sync -> noteLock sync`。
  - `E7` [fastnote/src/processes/session/model/use-session-bootstrap.ts:152]：启动失败时 deferred private route 会回退到 `/home`。
- 现状结论：
  - 本地读取能力已存在，但系统级启动仍会影响私有深链接首屏。
- 推断与待确认：
  - [推断] Agent 侧应独立于 `shouldBlockPrivateRoute`，先用本地对象渲染，再让后台刷新补齐。

#### 3.2.3 技术方案

- 方案摘要：
  - 引入 `AgentReadSource = store | persisted-cache | unavailable`，先读本地，再等待后台同步纠偏。
- 架构落点（按层）：
  - UI（`views/components`）：
    - 若对象本地可读，直接渲染任务与详情；若不可读，显示“正在恢复本地数据/对象不存在”。
  - 编排（`hooks`）：
    - `get_note_detail` 扩展返回 `source` 字段。
    - `useAiChat()` 根据 `source` 决定是否继续执行。
  - 领域（`stores`）：
    - 继续以 note store 为即时真相源。
  - 持久化（`database`）：
    - 若 store 未命中，可选读取既有本地缓存快照。
  - 云端（`pocketbase`）：
    - 远端同步继续后台执行，不作为详情读取前置。
  - 路由（`router`）：
    - 启动失败不应对已命中的本地私有对象强制跳 `/home`。
- 数据契约变更：
  - 字段/类型：
    - `AiNoteDetailItem.source`
  - 兼容与迁移：
    - 缺省为 `store`。
- 同步与冲突策略：
  - 读取阶段不主动拉起同步。
  - 后台同步结果如刷新到更高 `updated`，只更新展示，不自动重放任务。
- 错误处理与回滚策略：
  - 读取对象缺失：进入 `object_not_found`。
  - 启动链路失败：保留当前路由和本地结果，提示后台同步异常。

#### 3.2.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T4 | 为 `get_note_detail` 增加读取来源元数据 | `fastnote/src/features/ai-note-command/model/use-ai-note-command.ts` | 无 | 低 |
| T5 | Agent 编排器基于 local-first 结果推进任务 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts` | T4 | 中 |
| T6 | 启动链路补“本地对象已命中时不回跳 home”保护 | `fastnote/src/processes/session/model/use-session-bootstrap.ts` | T5 | 高 |

#### 3.2.5 验收标准

- AC1：本地对象可读时，Agent 不等待远端刷新即可继续任务。
- AC2：启动失败时，不因后台同步失败丢失已命中的私有深链接。
- AC3：对象确实不存在时，显示对象不可用，而不是黑屏。

#### 3.2.6 测试与验证

- 单元测试：
  - `get_note_detail` 返回 `source=store`。
- 集成/冒烟：
  - 新标签页打开 `/n/<noteId>`，本地可见后 AI 立即可用。
- 回归关注点：
  - 非私有路由不应受影响。

#### 3.2.7 风险与未决问题

- 风险：
  - 启动链路与路由守卫改动不慎会影响登录恢复。
- 未决问题：
  - 是否需要独立的“本地对象可见但云端未校验”提示。

## 4. 附录：模块证据索引

| 证据ID | 代码位置 | 摘要 |
| ------ | -------- | ---- |
| E1 | `fastnote/src/features/global-search/ui/global-search.vue:148` | AI 请求上下文来源 |
| E2 | `fastnote/src/features/ai-chat/model/request-context.ts:139` | 本地上下文 system prompt 组装 |
| E3 | `fastnote/src/features/ai-chat/model/openai-compatible-chat-transport.ts:65` | 提示词中已支持 fastnote URL |
| E4 | `fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:300` | `get_note_detail` 当前走本地 `getNote()` |
| E5 | `fastnote/src/entities/note/model/state/note-store.ts:131` | `getNote()` 本地索引读取 |
| E6 | `fastnote/src/processes/session/model/use-session-bootstrap.ts:118` | 登录启动仍串行同步 |
| E7 | `fastnote/src/processes/session/model/use-session-bootstrap.ts:152` | 启动失败时会回退 `/home` |
