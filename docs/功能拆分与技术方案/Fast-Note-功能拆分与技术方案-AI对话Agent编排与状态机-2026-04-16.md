# AI 对话 Agent 编排与状态机技术方案（Fast-Note）

## 1. 文档信息

- 模块名称：AI 对话 Agent 编排与状态机
- 输出日期：2026-04-16
- 输出文件：`docs/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-AI对话Agent编排与状态机-2026-04-16.md`
- 对应总览：`docs/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-总览-AI对话Agent能力-2026-04-16.md`
- 模块范围：
  - 任务级会话模型
  - 多步工具调用状态流转
  - 最终结果收口与中断态
- 不在范围：
  - 服务端 Agent 编排
  - 多任务并发
  - 长期记忆/摘要层

## 2. 模块目标与现状

- 业务目标：
  - 将当前“消息级工具调用助手”升级为“任务级、多步、有状态、可恢复”的前端 Agent。
- 当前状态（已支持/部分支持/未支持）：部分支持
- 关键证据：
  - `E1` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:38]：当前 AI 入口基于 `Chat<UIMessage>`，会话模型仍以消息为核心。
  - `E2` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:201]：当前只持久化消息文本与结果卡片，没有任务对象。
  - `E3` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:434]：当前工具结果会作为隐藏 system message 回传模型继续请求。
  - `E4` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:460]：当前已支持有限深度的自动续跑，但状态只有“是否待确认”。
  - `E5` [fastnote/src/features/ai-chat/ui/ai-chat-panel.vue:229]：当前 UI 只展示确认区，没有“执行中/中断/待继续”任务视图。
- 已知缺口：
  - 缺少任务级实体。
  - 缺少步骤状态、终止原因和恢复策略。
  - 缺少“执行中刷新后转待继续”的显式表达。

## 3. 逐功能点方案

### 3.1 F1.1 任务级会话状态机

#### 3.1.1 目标与边界

- 用户场景：
  - 用户发出“读取这条笔记并帮我重写”后，需要看到这是一个任务，而不是两三条零散消息。
- 范围内：
  - 新增 Agent 任务实体、任务步骤、任务状态。
  - UI 以任务状态驱动结果展示。
- 范围外：
  - 不展示完整推理链。
  - 不支持多个任务并发。

#### 3.1.2 现状证据

- 代码事实：
  - `E1` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:528]：当前可见消息只有 `user / assistant`。
  - `E2` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:567]：当前 `sessionPhase` 仅区分 `thinking/responding/ready/error/unconfigured`。
  - `E3` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:498]：当前 envelope 处理直接替换助手消息文本，没有独立任务态。
- 现状结论：
  - 现有状态只能表达“聊天请求状态”，不能表达“任务执行状态”。
- 推断与待确认：
  - [推断] 首期最稳的做法是在 `features/ai-chat/model` 内新增任务 store，而不是把任务态混进 `UIMessage`。

#### 3.1.3 技术方案

- 方案摘要：
  - 新增 `AiAgentTask` 及步骤状态机，消息继续保留为展示层，任务成为编排层主对象。
- 架构落点（按层）：
  - UI（`views/components`）：
    - `AiChatPanel` 新增任务摘要条与中断/继续入口。
  - 编排（`hooks`）：
    - 在 `useAiChat()` 中新增 `currentTask`、`taskHistory`、`startTask()`、`advanceTask()`、`interruptTask()`。
  - 领域（`stores`）：
    - 新增 `AiAgentTaskStatus = identifying | reading | executing | waiting_confirmation | interrupted | completed | failed | cancelled`。
  - 持久化（`database`）：
    - 首期继续使用 `localStorage`，新 key 建议为 `ai-chat-agent-task`。
  - 云端（`pocketbase`）：
    - 无改动。
  - 路由（`router`）：
    - 无直接改动，但任务对象需记录 `routePathSnapshot`。
- 数据契约变更：
  - 字段/类型：
    - `AiAgentTask`
    - `AiAgentTaskStep`
    - `AiAgentTaskResult`
  - 兼容与迁移：
    - 无旧任务数据时按空值处理，不影响现有消息恢复。
- 同步与冲突策略：
  - 任务状态更新只影响本地编排状态，不直接触发同步。
- 错误处理与回滚策略：
  - 任务创建失败时降级为普通问答。
  - 中途失败时设置 `failed`，保留最近一步与错误。

#### 3.1.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T1 | 定义 `AiAgentTask`、`AiAgentTaskStep` 类型 | `fastnote/src/features/ai-chat/model/*` | 无 | 低 |
| T2 | 在 `useAiChat()` 中新增任务状态机与持久化 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts` | T1 | 中 |
| T3 | `AiChatPanel` 渲染任务摘要/中断态/继续入口 | `fastnote/src/features/ai-chat/ui/ai-chat-panel.vue` | T2 | 中 |

#### 3.1.5 验收标准

- AC1：任务型请求发送后创建 `AiAgentTask`。
- AC2：任务完成、失败、中断均有显式状态。
- AC3：UI 可区分普通聊天回复和任务执行结果。

#### 3.1.6 测试与验证

- 单元测试：
  - 任务状态机从 `identifying -> reading -> completed` 的流转。
- 集成/冒烟：
  - 发起“读取并重写”后，面板出现任务状态与最终结果。
- 回归关注点：
  - 普通问答不应被错误标记为任务。

#### 3.1.7 风险与未决问题

- 风险：
  - 任务态与消息态双存储后，若同步顺序不一致，UI 可能短暂闪烁。
- 未决问题：
  - 任务历史是否首期展示，还是仅恢复当前任务。

### 3.2 F1.2 连续工具调用协议与终止条件

#### 3.2.1 目标与边界

- 用户场景：
  - `get_note_detail` 返回正文后，Agent 继续完成改写，不停在中间。
- 范围内：
  - 统一续跑输入格式、终止原因、深度限制。
- 范围外：
  - 不引入服务端 function calling。

#### 3.2.2 现状证据

- 代码事实：
  - `E4` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:460]：当前 `resolveAssistantToolLoop()` 递归续跑，深度上限为 3。
  - `E6` [fastnote/tests/integration/global-search/global-search-ai-chat.spec.ts:982]：已覆盖“读取详情后继续回答”的回归场景。
  - `E7` [fastnote/src/features/ai-chat/model/openai-compatible-chat-transport.ts:68]：当前协议仍要求模型返回 JSON envelope。
- 现状结论：
  - 当前已有续跑框架，但没有结构化的终止原因和任务步骤记录。
- 推断与待确认：
  - [推断] 应在 envelope 外再加本地 `toolLoopFrame` 记录，便于调试与恢复。

#### 3.2.3 技术方案

- 方案摘要：
  - 将现有递归续跑升级为“任务帧驱动”的有限状态执行器。
- 架构落点（按层）：
  - UI（`views/components`）：
    - 显示“正在读取”“正在等待工具结果”“等待确认”“任务已中断”。
  - 编排（`hooks`）：
    - `useAiChat()` 新增 `runAgentLoop(taskId)`，替代裸递归。
    - 每次工具执行后记录 `toolCall`、`toolResult`、`nextAction`。
  - 领域（`stores`）：
    - 新增 `AiAgentTerminationReason = completed | waiting_confirmation | max_depth | invalid_envelope | tool_failed | interrupted`。
  - 持久化（`database`）：
    - 当前任务只持久化最近一帧，避免 localStorage 过大。
  - 云端（`pocketbase`）：
    - 无改动。
  - 路由（`router`）：
    - 无改动。
- 数据契约变更：
  - 字段/类型：
    - `AiAgentLoopFrame`
    - `terminationReason`
  - 兼容与迁移：
    - 旧逻辑无迁移要求。
- 同步与冲突策略：
  - 仅当进入确认或完成写操作时，才调用既有同步链路。
- 错误处理与回滚策略：
  - envelope 非法：降级为自然语言错误说明。
  - 工具失败：记录失败帧并终止任务。
  - 达到深度上限：进入 `interrupted`，要求用户继续。

#### 3.2.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T4 | 抽离 `runAgentLoop()` 与 `AiAgentLoopFrame` | `fastnote/src/features/ai-chat/model/use-ai-chat.ts` | T1 | 中 |
| T5 | 为续跑补充终止原因、步骤日志与任务状态映射 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts` | T4 | 中 |
| T6 | 为工具续跑补充单测/集成测试 | `fastnote/tests/unit/features/ai-chat/*`, `fastnote/tests/integration/global-search/*` | T5 | 中 |

#### 3.2.5 验收标准

- AC1：`get_note_detail` 后必须继续收口为最终回答或待确认写入。
- AC2：达到深度上限时，状态为 `已中断/待继续`，而不是静默结束。
- AC3：工具失败时展示失败步骤与终止原因。

#### 3.2.6 测试与验证

- 单元测试：
  - 非法 envelope、达到深度上限、工具失败三类终止场景。
- 集成/冒烟：
  - “读取链接并重写”触发两次请求，第二次请求包含正文内容。
- 回归关注点：
  - 现有 `confirmation_required` 不应被自动越过。

#### 3.2.7 风险与未决问题

- 风险：
  - localStorage 中保存过多工具结果摘要会膨胀。
- 未决问题：
  - 是否需要首期展示“工具轨迹调试视图”。

### 3.3 F1.3 结果收口与继续入口

#### 3.3.1 目标与边界

- 用户场景：
  - 任务完成时看到明确结论；任务中断时看到“继续任务”而不是空白。
- 范围内：
  - 完成/失败/中断三种收口。
- 范围外：
  - 不实现复杂撤销。

#### 3.3.2 现状证据

- 代码事实：
  - `E5` [fastnote/src/features/ai-chat/ui/ai-chat-panel.vue:229]：当前只有待确认区域。
  - `E3` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:338]：当前完成时仅追加一条助手消息。
- 现状结论：
  - 缺少任务级“结束摘要”和“继续任务”入口。
- 推断与待确认：
  - [推断] 最终结果仍应保留在聊天流中，同时附任务摘要卡片。

#### 3.3.3 技术方案

- 方案摘要：
  - 为任务新增 `resultCard` 与 `resumeAction`。
- 架构落点（按层）：
  - UI（`views/components`）：
    - `AiChatPanel` 在任务中断态渲染“继续任务”按钮。
  - 编排（`hooks`）：
    - `resumeInterruptedTask(taskId)` 从最近终止帧恢复。
  - 领域（`stores`）：
    - 结果类型：`answer | mutation_result | interrupted_result | failure_result`。
  - 持久化（`database`）：
    - 持久化最近任务的 `resultCard`。
  - 云端（`pocketbase`）：
    - 无改动。
  - 路由（`router`）：
    - 恢复时验证当前路由对象是否仍匹配。
- 数据契约变更：
  - 字段/类型：
    - `AiAgentTaskResult`
  - 兼容与迁移：
    - 无。
- 同步与冲突策略：
  - 若恢复时对象已变化，则强制重新定位后再继续。
- 错误处理与回滚策略：
  - 恢复失败则保留历史结果，不覆盖原任务。

#### 3.3.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T7 | 定义 `AiAgentTaskResult` 与 `resumeInterruptedTask()` | `fastnote/src/features/ai-chat/model/*` | T2/T5 | 中 |
| T8 | 面板支持中断态结果和继续入口 | `fastnote/src/features/ai-chat/ui/ai-chat-panel.vue` | T7 | 中 |

#### 3.3.5 验收标准

- AC1：任务完成时有统一结果摘要。
- AC2：任务中断时有继续入口。
- AC3：恢复失败时保留原任务历史，不丢上下文。

#### 3.3.6 测试与验证

- 单元测试：
  - `resumeInterruptedTask()` 在对象匹配/不匹配下的行为。
- 集成/冒烟：
  - 手动刷新执行中任务后恢复为中断态，再点继续任务。
- 回归关注点：
  - 清空会话时应同时清理任务态。

#### 3.3.7 风险与未决问题

- 风险：
  - 用户可能将“继续任务”理解成无条件重放，需在文案上提示可能重新读取。
- 未决问题：
  - 是否需要限制恢复入口的有效时间。

## 4. 附录：模块证据索引

| 证据ID | 代码位置 | 摘要 |
| ------ | -------- | ---- |
| E1 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts:38` | AI 对话当前以消息流为主 |
| E2 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts:201` | 会话持久化当前没有任务层 |
| E3 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts:434` | 工具结果当前通过隐藏 system message 回传 |
| E4 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts:460` | 当前递归续跑与深度上限 |
| E5 | `fastnote/src/features/ai-chat/ui/ai-chat-panel.vue:229` | 当前 UI 只提供待确认态 |
| E6 | `fastnote/tests/integration/global-search/global-search-ai-chat.spec.ts:982` | 已覆盖读取详情后继续回答 |
| E7 | `fastnote/src/features/ai-chat/model/openai-compatible-chat-transport.ts:68` | 当前协议仍为 JSON envelope |
