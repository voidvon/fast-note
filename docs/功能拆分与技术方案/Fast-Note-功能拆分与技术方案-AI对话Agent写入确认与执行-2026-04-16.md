# AI 对话 Agent 写入确认与执行技术方案（Fast-Note）

## 1. 文档信息

- 模块名称：AI 对话 Agent 写入确认与执行
- 输出日期：2026-04-16
- 输出文件：`docs/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-AI对话Agent写入确认与执行-2026-04-16.md`
- 对应总览：`docs/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-总览-AI对话Agent能力-2026-04-16.md`
- 模块范围：
  - 风险分级与确认策略
  - 改写任务直写
  - 统一写执行与结果回执
- 不在范围：
  - 批量写入
  - 撤销能力

## 2. 模块目标与现状

- 业务目标：
  - 在允许“明确指令直接写回”的前提下，仍保持可控执行与高风险保护。
- 当前状态（已支持/部分支持/未支持）：部分支持
- 关键证据：
  - `E1` [fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:99]：当前已定义工具级确认规则。
  - `E2` [fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:109]：工具预览当前已存在。
  - `E3` [fastnote/src/processes/ai-chat-session/model/use-ai-chat-session.ts:162]：待确认执行当前已支持提交、确认、取消。
  - `E4` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:670]：确认后当前只会追加执行摘要，不会回到原任务上下文继续收口。
  - `E5` [fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:224]：`update_note` 已支持标题、摘要、正文、父目录和版本检查。
- 已知缺口：
  - 改写类任务“建议文本”和“直写原文”没有产品级区分。
  - 确认后未回到任务闭环。
  - 工具级风险规则和任务级风险规则尚未统一。

## 3. 逐功能点方案

### 3.1 F3.1 任务级风险分级与确认映射

#### 3.1.1 目标与边界

- 用户场景：
  - 用户说“直接把这段改写后覆盖原文”，系统允许执行；用户说“删掉这些笔记”，系统必须拦截为预览。
- 范围内：
  - 统一任务级风险分级。
  - 映射到工具级 `requireConfirmation / confirmed`。
- 范围外：
  - 批量审批流。

#### 3.1.2 现状证据

- 代码事实：
  - `E1` [fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:99]：`move/delete/lock` 当前默认需要确认。
  - `E2` [fastnote/src/processes/ai-chat-session/model/use-ai-chat-session.ts:166]：命中确认需求后当前会进入 `pendingExecution`。
  - `E3` [fastnote/src/features/ai-chat/ui/ai-chat-panel.vue:229]：当前 UI 只展示确认区，不区分任务语义。
- 现状结论：
  - 工具层已有限制，但任务层没有“明确直写”这类语义。
- 推断与待确认：
  - [推断] 应在 Agent 层引入 `riskLevel`，再映射到工具层。

#### 3.1.3 技术方案

- 方案摘要：
  - Agent 先识别任务风险，再决定是否为 `update_note` 自动构造 `confirmed`。
- 架构落点（按层）：
  - UI（`views/components`）：
    - 展示“将直接写回原文”或“需确认”提示。
  - 编排（`hooks`）：
    - 新增 `classifyAgentMutationRisk(task)`。
  - 领域（`stores`）：
    - 风险级别：`low / medium / high`。
  - 持久化（`database`）：
    - 记录任务风险级别与用户确认结果。
  - 云端（`pocketbase`）：
    - 无改动。
  - 路由（`router`）：
    - 无改动。
- 数据契约变更：
  - 字段/类型：
    - `AiAgentTask.riskLevel`
    - `AiAgentTask.confirmationMode`
  - 兼容与迁移：
    - 无。
- 同步与冲突策略：
  - 仍复用既有 `sync(true)`，但只在正式执行时触发。
- 错误处理与回滚策略：
  - 风险判断不明确时，一律降为需确认。

#### 3.1.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T1 | 定义任务级风险模型与工具映射 | `fastnote/src/features/ai-chat/model/*` | 无 | 低 |
| T2 | 在 Agent 编排中加入风险分级 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts` | T1 | 中 |
| T3 | 确认区增加任务语义文案 | `fastnote/src/features/ai-chat/ui/ai-chat-panel.vue` | T2 | 低 |

#### 3.1.5 验收标准

- AC1：`delete/move/lock` 默认进入待确认。
- AC2：目标不唯一时，任何写任务都不得直写。
- AC3：无法识别风险时，默认预览。

#### 3.1.6 测试与验证

- 单元测试：
  - 任务级风险到工具级确认映射。
- 集成/冒烟：
  - “删除 note-1”进入确认态。
- 回归关注点：
  - 现有 `pendingExecution` 流程保持可用。

#### 3.1.7 风险与未决问题

- 风险：
  - 模型表达模糊时，过度保守会影响体验。
- 未决问题：
  - 是否需要在 UI 中提供“始终先预览”用户偏好。

### 3.2 F3.2 改写任务直写与结果回流

#### 3.2.1 目标与边界

- 用户场景：
  - 用户明确说“直接重写这条笔记”，Agent 完成改写后直接写回，并明确告诉用户已经改了什么。
- 范围内：
  - 改写任务直写。
  - 确认后回到任务闭环继续收口。
- 范围外：
  - 富文本局部 patch。

#### 3.2.2 现状证据

- 代码事实：
  - `E4` [fastnote/src/features/ai-chat/model/use-ai-chat.ts:670]：确认执行后当前只追加“执行结果如下”。
  - `E5` [fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:224]：`update_note` 已支持完整内容写回。
  - `E6` [fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:191]：写操作成功后会排队同步。
- 现状结论：
  - 底层写能力已可用，但任务闭环未完成。
- 推断与待确认：
  - [推断] 改写结果应先在任务内形成 `proposedContent`，再决定是否直接写回。

#### 3.2.3 技术方案

- 方案摘要：
  - 新增 `rewrite` 任务结果结构：`proposedContent + commitMode(suggest|direct)`。
- 架构落点（按层）：
  - UI（`views/components`）：
    - 展示“已直接写回”或“以下是建议文本”。
  - 编排（`hooks`）：
    - 当用户指令包含“直接写回/直接覆盖”且对象唯一时，Agent 将改写结果转成 `update_note`。
    - `confirmPendingExecution()` 完成后回到 `runAgentLoop()` 做最后收口。
  - 领域（`stores`）：
    - 无新增核心 store，复用 `useAiNoteCommand`。
  - 持久化（`database`）：
    - 保存最后一次 `proposedContent` 与执行结果摘要。
  - 云端（`pocketbase`）：
    - 无改动。
  - 路由（`router`）：
    - 写回当前笔记后保持当前路由不变。
- 数据契约变更：
  - 字段/类型：
    - `AiAgentRewriteResult`
    - `commitMode: suggest | direct`
  - 兼容与迁移：
    - 无。
- 同步与冲突策略：
  - 若 `expectedUpdated` 冲突，任务进入 `failed` 并提示重新读取。
- 错误处理与回滚策略：
  - 改写生成成功但写回失败时，保留建议文本，不丢失结果。

#### 3.2.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T4 | 新增改写结果结构与直写判定 | `fastnote/src/features/ai-chat/model/*` | T1 | 中 |
| T5 | `confirmPendingExecution()` 后接回任务收口 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts` | T4 | 中 |
| T6 | 补齐“建议文本/已写回”两类回归测试 | `fastnote/tests/integration/global-search/*` | T5 | 中 |

#### 3.2.5 验收标准

- AC1：明确指令下改写可直接写回。
- AC2：写回完成后返回变更摘要，而不是只显示工具执行摘要。
- AC3：写回失败时保留改写结果供用户复制/再次提交。

#### 3.2.6 测试与验证

- 单元测试：
  - 直写判定、冲突失败后保留建议文本。
- 集成/冒烟：
  - “读取这条笔记并直接重写”完成后页面正文已更新，聊天流显示写回结果。
- 回归关注点：
  - 非直写场景仍只返回建议文本。

#### 3.2.7 风险与未决问题

- 风险：
  - 富文本全文覆盖若无差异摘要，用户感知可能偏弱。
- 未决问题：
  - 是否需要首期显示“前后 diff 摘要”。

## 4. 附录：模块证据索引

| 证据ID | 代码位置 | 摘要 |
| ------ | -------- | ---- |
| E1 | `fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:99` | 默认确认规则 |
| E2 | `fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:109` | 工具预览结构 |
| E3 | `fastnote/src/processes/ai-chat-session/model/use-ai-chat-session.ts:162` | 提交/确认/取消待确认执行 |
| E4 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts:670` | 当前确认后未回到任务闭环 |
| E5 | `fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:224` | `update_note` 已支持完整写回 |
| E6 | `fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:191` | 写操作成功后同步排队 |
