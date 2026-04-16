# AI 对话能力优化技术方案（fastnote）

## 1. 文档信息

- 模块名称：AI 对话能力优化
- 输出日期：2026-04-15
- 输出文件：`docs/功能拆分与技术方案/fastnote-功能拆分与技术方案-AI对话能力优化-2026-04-15.md`
- 对应总览：`docs/功能拆分与技术方案/fastnote-功能拆分与技术方案-总览-AI对话能力优化-2026-04-15.md`
- 模块范围：
  - 现有 AI 对话入口与上下文装配升级
  - 接入 `ai-note-command` 与 `ai-chat-session`
  - 结构化响应与确认交互
  - 结构化会话持久化
- 不在范围：
  - 服务端代理与密钥托管
  - 长期记忆/摘要层
  - 新模型平台与多供应商路由

## 2. 模块目标与现状

- 业务目标：
  - 在保留现有首页 AI 入口体验的前提下，把当前“纯聊天面板”升级为“上下文感知 + 可执行笔记操作”的 AI 对话能力。
- 当前状态（已支持/部分支持/未支持）：部分支持
- 关键证据：
  - `E1` [fastnote/src/features/global-search/ui/global-search.vue:30-39]：首页入口已接入 AI 对话模式。
  - `E2` [fastnote/src/features/global-search/ui/global-search.vue:301-317]：当前提交逻辑只发送纯文本消息。
  - `E3` [fastnote/src/features/ai-chat/model/openai-compatible-chat-transport.ts:143-180]：当前传输层只拼系统提示词与历史纯文本消息。
  - `E4` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:90-157]：当前只持久化纯文本消息。
  - `E5` [fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:257-399]：工具执行器已具备搜索、读取、创建、更新、移动、删除、锁定能力。
  - `E6` [fastnote/src/processes/ai-chat-session/model/use-ai-chat-session.ts:30-57]：确认执行会话已具备预览和确认后二次执行能力。
  - `E7` [fastnote/src/entities/note/model/state/note-store.ts:306-337]：现有本地搜索已支持递归召回笔记。
  - `E8` [fastnote/src/features/note-write/model/use-note-write.ts:126-175]：现有写接口已处理版本冲突和父目录计数更新。
- 已知缺口：
  - 入口与工具会话未打通。
  - 无结构化响应 schema。
  - 无结构化持久化模型。
  - 浏览器直连安全边界仍然较弱。

## 3. 逐功能点方案

### 3.1 F1.1 从纯聊天入口升级为上下文感知 AI 对话

#### 3.1.1 目标与边界

- 用户场景：
  - 用户在首页 AI 对话模式下发出“帮我找上周会议记录”“把当前笔记改得更清晰”时，系统应优先利用现有 fastnote 上下文，而不是只发一段裸文本给模型。
- 范围内：
  - 入口仍保持在 `GlobalSearch` 内。
  - 注入当前模式、当前选中笔记、当前搜索候选、当前目录范围等运行时上下文。
- 范围外：
  - 不在本功能点中直接执行笔记写操作。
  - 不在本功能点中调整服务端链路。

#### 3.1.2 现状证据

- 代码事实：
  - `E1` [fastnote/src/features/global-search/ui/global-search.vue:30-39]：当前入口已可切到 AI 模式。
  - `E2` [fastnote/src/features/global-search/ui/global-search.vue:301-317]：当前发送逻辑只把 `draft` 交给 `sendAiMessage()`。
  - `E3` [fastnote/src/features/ai-chat/model/openai-compatible-chat-transport.ts:143-180]：transport 只发送系统提示词与纯文本消息。
  - `E7` [fastnote/src/entities/note/model/state/note-store.ts:306-337]：现有本地搜索能力可用于召回候选上下文。
- 现状结论：
  - 当前入口已稳定，但上下文感知不足。
- 推断与待确认：
  - [推断] 首期上下文装配可完全在前端完成，不需要改 Dexie schema。

#### 3.2.3 技术方案

- 方案摘要：
  - 在 `features/ai-chat` 与 `features/global-search` 之间增加一层 `AI 对话编排上下文`，统一收集当前页面状态与搜索候选，生成送模上下文。
- 架构落点（按层）：
  - UI（`views/components`）：
    - `GlobalSearch` 保持入口与模式切换。
    - `AiChatPanel` 新增上下文状态展示，如“当前基于：当前笔记 / 搜索结果 / 工作文件夹”。
  - 编排（`hooks`）：
    - 新增 `useAiChatOrchestrator()`，负责：
      - 识别当前页面上下文
      - 调用 `searchNotesByParentId()` 或 `searchNotesInDatabase()` 做候选召回
      - 生成送模 prompt 上下文块
    - `useAiChat().sendMessage()` 不再直接只接收纯文本，而是接收 `text + runtimeContext`。
  - 领域（`stores`）：
    - 继续复用 `note-store` 的本地真相源和搜索能力，不新增新 store。
  - 持久化（`database`）：
    - 不改 Dexie schema。
  - 云端（`pocketbase`）：
    - 无改动。
  - 路由（`router`）：
    - 无改动。
- 数据契约变更：
  - 字段/类型：
    - 新增 `AiRuntimeContext`，包含：
      - `activeNoteId?`
      - `activeFolderId?`
      - `searchCandidates?`
      - `scopeLabel?`
  - 兼容与迁移：
    - 不影响现有 `Note` 契约。
- 同步与冲突策略：
  - 仅查询，不涉及同步。
- 错误处理与回滚策略：
  - 上下文装配失败时，降级为当前纯文本聊天，不阻断基础能力。

#### 3.1.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T1 | 定义 `AiRuntimeContext` 与上下文装配 helper | `features/ai-chat/model/*` | 无 | 低 |
| T2 | 在 `GlobalSearch` 中收集当前搜索候选/当前模式上下文 | `features/global-search/ui/global-search.vue` | T1 | 低 |
| T3 | 改造 `useAiChat` 发送参数，支持携带上下文 | `features/ai-chat/model/use-ai-chat.ts` | T1 | 中 |
| T4 | 调整 transport 的 message 拼装，插入上下文块 | `features/ai-chat/model/openai-compatible-chat-transport.ts` | T3 | 中 |

#### 3.1.5 验收标准

- AC1：AI 模式发送消息时，可根据当前搜索候选范围生成回答，而不是只基于裸文本。
- AC2：上下文装配失败时，纯文本聊天能力不回退。
- AC3：上下文注入不应把全量笔记全文直接送模。

#### 3.1.6 测试与验证

- 单元测试：
  - 上下文装配函数输入不同页面状态时输出正确上下文块。
- 集成/冒烟：
  - 在搜索结果模式下切 AI，对“这些结果里哪个最像会议纪要”得到基于候选结果的回复。
- 回归关注点：
  - 现有纯聊天流式能力不被破坏。

#### 3.1.7 风险与未决问题

- 风险：
  - 如果上下文块过大，仍可能拉高 token 成本。
- 未决问题：
  - 首期上下文最多带多少条候选结果。

### 3.2 F1.2 接入 AI 笔记工具执行器与确认链路

#### 3.2.1 目标与边界

- 用户场景：
  - 用户在 AI 对话中说“把这条笔记移到工作文件夹”“删掉这条笔记”，系统应能先预览，再确认执行。
- 范围内：
  - 接入 `useAiNoteCommand()` 与 `useAiChatSession()`。
  - 支持结构化预览和确认执行。
- 范围外：
  - 暂不实现复杂批量规则与自动归类。
  - 暂不引入服务端工具调用编排。

#### 3.2.2 现状证据

- 代码事实：
  - `E5` [fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:257-399]：工具执行器已能执行核心笔记动作。
  - `E6` [fastnote/src/processes/ai-chat-session/model/use-ai-chat-session.ts:30-57]：确认会话已支持预览与确认后二次执行。
  - `E8` [fastnote/src/features/note-write/model/use-note-write.ts:126-175]：底层写接口已处理版本冲突和目录计数。
  - `E2` [fastnote/src/features/global-search/ui/global-search.vue:301-317]：现有入口未接入上述链路。
- 现状结论：
  - “能执行”和“能确认”的基础件已经具备，缺的是入口接线与交互承载。
- 推断与待确认：
  - [推断] 首期可以通过“模型返回约束 JSON”方式驱动工具链，而不用立刻引入完整服务端 agent 编排。

#### 3.1.3 技术方案

- 方案摘要：
  - 新增 `AI 对话编排器`，在模型回复中识别结构化动作意图并转换为 `AiNoteToolCall[]`，交给 `useAiChatSession()` 执行。
- 架构落点（按层）：
  - UI（`views/components`）：
    - `AiChatPanel` 新增预览卡片、确认按钮、取消按钮、执行结果卡片。
  - 编排（`hooks`）：
    - 新增 `useAiChatAgent()` 或 `useAiChatOrchestrator()`：
      - 发送消息给模型
      - 校验模型返回的结构化动作
      - 转换为 `AiNoteToolCall[]`
      - 调用 `submitToolCalls()`、`confirmPendingExecution()`
  - 领域（`stores`）：
    - 不新增领域状态，复用 `useAiNoteCommand()`。
  - 持久化（`database`）：
    - 不改 Dexie schema。
  - 云端（`pocketbase`）：
    - 无改动。
  - 路由（`router`）：
    - 无改动。
- 数据契约变更：
  - 字段/类型：
    - 新增 `AiAssistantEnvelope`
      - `mode: "answer" | "tool_calls" | "error"`
      - `answer?: string`
      - `toolCalls?: AiNoteToolCall[]`
  - 兼容与迁移：
    - 当模型未返回合法 envelope 时，降级为普通文本回答。
- 同步与冲突策略：
  - 工具执行成功后继续复用现有 `sync(true)` 行为。
  - `update_note` 保持 `expectedUpdated` 版本冲突检查。
- 错误处理与回滚策略：
  - 结构化解析失败：降级文本回答。
  - 工具执行失败：以结构化失败消息回写到会话。
  - 需要确认的工具：只生成 preview，不直接落库。

#### 3.2.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T5 | 定义 `AiAssistantEnvelope` 与解析逻辑 | `features/ai-chat/model/*` | T1 | 中 |
| T6 | 新增 AI 编排器，接通 `useAiChatSession()` | `features/ai-chat` / `processes/ai-chat-session` | T5 | 中 |
| T7 | 在 `AiChatPanel` 中渲染 preview/result/error 卡片 | `features/ai-chat/ui/ai-chat-panel.vue` | T6 | 中 |
| T8 | 接入确认/取消动作并触发二次执行 | `features/ai-chat/ui/*` | T6 | 中 |

#### 3.2.5 验收标准

- AC1：模型返回合法工具调用时，界面展示结构化预览而不是立即执行。
- AC2：用户确认后，工具执行结果能回显到当前会话。
- AC3：未确认的高风险操作不会落库。

#### 3.2.6 测试与验证

- 单元测试：
  - 工具 envelope 解析测试。
  - 预览/确认/取消状态机测试。
- 集成/冒烟：
  - “删除这条笔记”先出现确认卡片，确认后软删除成功。
  - “把这条笔记移到工作文件夹”确认后移动成功。
- 回归关注点：
  - 现有 `ai-note-command` 单测语义保持不变。

#### 3.2.7 风险与未决问题

- 风险：
  - 纯文本模型输出 JSON 时存在格式不稳定风险。
- 未决问题：
  - 首期是否接受“模型返回不合法就降级文本”的体验。

### 3.3 F1.3 结构化响应与会话持久化升级

#### 3.3.1 目标与边界

- 用户场景：
  - 用户刷新页面后，不仅能恢复文本消息，还能恢复预览卡片、执行结果和失败提示。
- 范围内：
  - 升级当前本地会话持久化模型。
  - 兼容已有纯文本历史会话。
- 范围外：
  - 不做服务端云端会话同步。

#### 3.3.2 现状证据

- 代码事实：
  - `E4` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:90-157]：当前会话只保留用户/助手 `id + role + text`。
  - `E10` [fastnote/tests/integration/global-search/global-search-ai-chat.spec.ts:497-554]：当前恢复测试只覆盖纯文本消息恢复。
- 现状结论：
  - 一旦接入 preview/result/error 卡片，当前持久化模型不够用。
- 推断与待确认：
  - [推断] 保持兼容最稳的方式是定义新的结构化消息数组，同时兼容读取旧消息格式。

#### 3.3.3 技术方案

- 方案摘要：
  - 引入 `AiChatStoredMessage` 联合类型，兼容 `text`、`preview`、`result`、`failure` 四类本地消息。
- 架构落点（按层）：
  - UI（`views/components`）：
    - `AiChatPanel` 按消息类型渲染不同卡片。
  - 编排（`hooks`）：
    - `useAiChat` 负责结构化消息的持久化与恢复。
  - 领域（`stores`）：
    - 无改动。
  - 持久化（`database`）：
    - 继续使用 `localStorage`，但升级数据结构。
  - 云端（`pocketbase`）：
    - 无改动。
  - 路由（`router`）：
    - 无改动。
- 数据契约变更：
  - 字段/类型：
    - `AiChatStoredMessage = TextMessage | PreviewMessage | ResultMessage | FailureMessage`
  - 兼容与迁移：
    - 读取时先判断是否旧版 `{id, role, text}`，若是则升级成 `TextMessage`。
- 同步与冲突策略：
  - 无远端同步。
- 错误处理与回滚策略：
  - 结构化消息解析失败时清理损坏记录并回退为空会话。

#### 3.3.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T9 | 定义结构化会话消息类型 | `features/ai-chat/model/*` | T5 | 低 |
| T10 | 改造持久化与恢复逻辑，兼容旧格式 | `features/ai-chat/model/use-ai-chat.ts` | T9 | 中 |
| T11 | 补结构化消息渲染组件 | `features/ai-chat/ui/*` | T9 | 中 |

#### 3.3.5 验收标准

- AC1：文本消息、预览消息、执行结果消息都可被刷新后恢复。
- AC2：旧版纯文本会话仍能正常读出。
- AC3：损坏的结构化会话记录不会导致面板崩溃。

#### 3.3.6 测试与验证

- 单元测试：
  - 新旧格式恢复兼容测试。
- 集成/冒烟：
  - 执行一次预览 -> 确认 -> 成功后刷新页面，确认完整消息恢复。
- 回归关注点：
  - 原有纯文本恢复测试继续通过。

#### 3.3.7 风险与未决问题

- 风险：
  - 结构化消息数量增多后，本地存储体积会增加。
- 未决问题：
  - 是否限制本地会话保留条数。

### 3.4 F1.4 安全边界与后续迁移位

#### 3.4.1 目标与边界

- 用户场景：
  - 当前浏览器直连模式可继续使用，但必须明确这是短期方案，并为后续迁移服务端代理预留接口位。
- 范围内：
  - 明确前端提示、配置校验、日志留痕。
  - 为 transport 抽象保留替换能力。
- 范围外：
  - 不在本轮真正实现服务端代理。

#### 3.4.2 现状证据

- 代码事实：
  - `E9` [fastnote/src/features/ai-chat/ui/ai-chat-settings-card.vue:21-23]：当前已经提示浏览器直连风险。
  - `E3` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:82-88]：配置直接落本地存储。
- 现状结论：
  - 当前风险已被提示，但治理能力不足。
- 推断与待确认：
  - [推断] 在不改服务端的前提下，至少应加入更明显的短期方案标识与错误诊断信息。

#### 3.4.3 技术方案

- 方案摘要：
  - 保持 transport 接口不变，短期增强提示和诊断，长期将 `OpenAiCompatibleChatTransport` 替换为服务端代理 transport。
- 架构落点（按层）：
  - UI（`views/components`）：
    - 配置卡补“直连模式仅限开发/受信任环境”标识。
  - 编排（`hooks`）：
    - `useAiChat` 补充配置校验失败文案与诊断字段。
  - 领域（`stores`）：
    - 无改动。
  - 持久化（`database`）：
    - 本地配置可继续保留。
  - 云端（`pocketbase`）：
    - 本轮无改动，但后续可在服务端代理时承接安全能力。
  - 路由（`router`）：
    - 无改动。
- 数据契约变更：
  - 字段/类型：
    - 可新增 `providerMode: "browser_direct"` 显式标识。
  - 兼容与迁移：
    - 默认值设为 `browser_direct`。
- 同步与冲突策略：
  - 无。
- 错误处理与回滚策略：
  - 请求失败时继续保留当前 `retry` 行为。

#### 3.4.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T12 | 补 provider mode 显式标识与 UI 提示 | `features/ai-chat/ui/*` | 无 | 低 |
| T13 | 预留 transport 抽象切换点 | `features/ai-chat/model/*` | 无 | 低 |

#### 3.4.5 验收标准

- AC1：用户能明确识别当前是浏览器直连模式。
- AC2：transport 替换点明确，不需要重写整套 AI 面板。

#### 3.4.6 测试与验证

- 单元测试：
  - 配置模式标识默认值与展示测试。
- 集成/冒烟：
  - 配置面板提示文案更新后可见。
- 回归关注点：
  - 现有配置保存/恢复不受影响。

#### 3.4.7 风险与未决问题

- 风险：
  - 若长期停留在浏览器直连模式，安全风险仍存在。
- 未决问题：
  - 什么时候迁移到服务端代理。

## 4. 附录：模块证据索引

| 证据ID | 代码位置 | 摘要 |
| ------ | -------- | ---- |
| E1 | `fastnote/src/features/global-search/ui/global-search.vue:30-39` | 首页已支持 AI 模式与搜索模式切换 |
| E2 | `fastnote/src/features/global-search/ui/global-search.vue:301-317` | 当前提交逻辑只把草稿文本交给 `sendAiMessage()` |
| E3 | `fastnote/src/features/ai-chat/model/openai-compatible-chat-transport.ts:143-180` | 当前送模消息只包含系统提示词和纯文本对话 |
| E4 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts:90-157` | 当前会话持久化只保留用户/助手纯文本 |
| E5 | `fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:257-399` | 工具执行器已具备核心笔记动作与确认需求 |
| E6 | `fastnote/src/processes/ai-chat-session/model/use-ai-chat-session.ts:30-57` | 确认会话已支持预览与确认后二次执行 |
| E7 | `fastnote/src/entities/note/model/state/note-store.ts:306-337` | 本地搜索能力可递归召回候选笔记 |
| E8 | `fastnote/src/features/note-write/model/use-note-write.ts:126-175` | 现有写接口已处理版本冲突与父目录计数 |
| E9 | `fastnote/src/features/ai-chat/ui/ai-chat-settings-card.vue:21-23` | 当前浏览器直连模式的风险提示已存在 |
