# Fast-Note 功能拆分与技术方案总览 - AI 对话 Agent 能力

## 1. 文档信息

- 版本/迭代：AI 对话 Agent 首期
- 输出日期：2026-04-16
- 输出文件：`docs/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-总览-AI对话Agent能力-2026-04-16.md`
- 输入来源：
  - `docs/需求文档/AI对话Agent能力PRD-2026-04-16.md`
  - 当前仓库代码：`main @ 94d9949 + working tree`
- 输出范围：
  - Agent 任务状态机
  - 连续工具调用协议
  - 对象定位与本地优先读取
  - 写入确认与执行
  - 刷新恢复与 PC 深链接路由保持
- 不在范围：
  - 服务端统一 Agent 编排平台
  - 通用网页/系统自动化
  - 多对象批量任务
  - 长期记忆/摘要层

## 2. 功能拆分总览

| 能力域 | 功能点 | 用户问题/价值 | 优先级 | 当前状态 | 关键证据 |
| ------ | ------ | ------------- | ------ | -------- | -------- |
| A1 Agent 编排与状态机 | F1 任务级会话、步骤状态、结果收口 | 避免“读完就停”“看不出任务是否完成” | P0 | 部分支持 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts:460` |
| A2 连续工具调用协议 | F2 工具结果回传、自动续跑、有限深度终止 | 让“读取 -> 改写 -> 回答/写回”形成闭环 | P0 | 部分支持 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts:434` |
| A3 对象定位与本地优先读取 | F3 URL 解析、当前上下文、本地搜索、local-first 读取 | 直接粘贴 `/n/<id>` 就能工作，且不被远端接口阻塞 | P0 | 部分支持 | `fastnote/src/features/global-search/ui/global-search.vue:148` |
| A4 写入确认与执行 | F4 风险分级、改写直写、统一执行器 | 允许明确指令直接写回，同时限制高风险误写 | P0 | 部分支持 | `fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:258` |
| A5 恢复与路由保持 | F5 待确认恢复、执行中中断恢复、PC 深链接保持 | 刷新后不回跳 `/home`，任务不重复执行 | P0 | 部分支持 | `fastnote/src/pages/home/ui/home-page.vue:258` |
| A6 可观测与测试 | F6 工具轨迹、失败原因、回归测试 | 保证 Agent 行为可回归验证 | P1 | 部分支持 | `fastnote/tests/integration/global-search/global-search-ai-chat.spec.ts:982` |

## 3. 模块文档索引

| 模块 | 文档文件 | 功能点数量 | 负责人建议 | 备注 |
| ---- | -------- | ---------- | ---------- | ---- |
| Agent 编排与状态机 | `Fast-Note-功能拆分与技术方案-AI对话Agent编排与状态机-2026-04-16.md` | 3 | 前端主程 | 首期主干 |
| 对象定位与本地读取 | `Fast-Note-功能拆分与技术方案-AI对话Agent对象定位与本地读取-2026-04-16.md` | 2 | 前端主程 | 与启动链路强相关 |
| 写入确认与执行 | `Fast-Note-功能拆分与技术方案-AI对话Agent写入确认与执行-2026-04-16.md` | 2 | 前端主程 | 依赖既有执行器 |
| 恢复与路由保持 | `Fast-Note-功能拆分与技术方案-AI对话Agent恢复与路由保持-2026-04-16.md` | 2 | 前端主程 | 与桌面端路由耦合 |

## 4. 里程碑与发布建议

- 里程碑划分：
  - M1：打通任务状态机与工具续跑协议。
  - M2：补齐对象定位、本地优先读取、执行中恢复策略。
  - M3：补齐写入确认、改写直写、回归测试与埋点。
- 上线策略：
  - 先在现有 AI 对话入口内灰度为“任务型请求启用 Agent 编排，普通问答仍走现有聊天流”。
  - 保留纯文本降级路径，避免 Agent 解析失败导致全量不可用。
- 灰度/回滚：
  - 通过 feature flag 或运行时开关控制 Agent 编排器。
  - 如出现高频误写或卡死，回退到“工具调用但不自动续跑”的旧模式。

## 5. 跨模块依赖与风险

- 依赖关系：
  - A1 依赖 A2 才能形成闭环。
  - A3 决定 A1/A2 的对象解析稳定性。
  - A4 依赖 A1 的任务状态与 A3 的唯一定位。
  - A5 依赖 A1 的任务持久化模型与现有桌面端路由保持逻辑。
- 关键风险：
  - 当前 `useAiChat()` 只有消息维度，没有任务维度，无法准确表达“执行中/待继续/已完成”。 
  - 当前 `useAiChatSession()` 只持久化 `pendingExecution + lastResults`，无法恢复执行中任务与步骤进度。
  - 当前登录态启动仍在 `bootstrapLoggedInSession()` 中串行 `sync(true)` 与 `noteLock.syncSecuritySettingsFromCloud(true)`，容易和深链接恢复产生竞态。
  - 当前工具协议仍基于模型自由输出 JSON envelope，格式稳定性不足。
- 需要业务决策的问题：
  - 首期只支持单对象单任务，已确认。
  - 改写任务允许明确指令直写，已确认。
  - 执行中任务刷新后恢复为 `已中断/待继续`，已确认。

## 6. 附录：证据索引

| 证据ID | 代码位置 | 摘要 |
| ------ | -------- | ---- |
| E1 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts:38` | AI 对话核心状态与 `Chat` 实例入口 |
| E2 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts:201` | 会话消息与卡片当前仅按消息维度持久化 |
| E3 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts:434` | 工具结果通过隐藏 system message 回传模型继续续跑 |
| E4 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts:460` | 当前已有有限深度工具续跑，但没有任务状态机 |
| E5 | `fastnote/src/processes/ai-chat-session/model/use-ai-chat-session.ts:162` | 待确认工具调用与确认执行当前已支持 |
| E6 | `fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:258` | AI 本地工具执行器当前覆盖搜索、读取、更新、移动、删除、加锁 |
| E7 | `fastnote/src/features/global-search/ui/global-search.vue:148` | 首页 AI 请求上下文当前包含路由、活动对象、候选对象、最近对象 |
| E8 | `fastnote/src/features/ai-chat/model/openai-compatible-chat-transport.ts:60` | 默认系统提示词已约束 FastNote URL 与工具调用格式 |
| E9 | `fastnote/src/processes/session/model/use-session-bootstrap.ts:118` | 登录会话启动当前仍串行执行本地上下文准备、同步与 PIN 同步 |
| E10 | `fastnote/src/pages/home/ui/home-page.vue:258` | PC 端当前通过原生 `history.pushState/replaceState` 保持深链接 |
| E11 | `fastnote/src/processes/navigation/model/use-desktop-active-note.ts:151` | 桌面端当前已有 `/n/<id>`、`/f/...` 路径生成工具 |
| E12 | `fastnote/src/widgets/note-detail-pane/ui/note-detail-pane.vue:306` | 移动端草稿转正式笔记时直接原生替换 URL |
| E13 | `fastnote/tests/integration/global-search/global-search-ai-chat.spec.ts:982` | 已有集成测试覆盖 `get_note_detail` 后继续回答 |
| E14 | `fastnote/tests/unit/features/ai-chat/openai-compatible-chat-transport.spec.ts:41` | 单测已覆盖默认提示词中的 URL 解析约束 |
