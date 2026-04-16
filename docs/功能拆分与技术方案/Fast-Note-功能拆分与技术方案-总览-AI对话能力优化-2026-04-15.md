# AI 对话能力优化总览（fastnote）

## 1. 文档信息

- 版本/迭代：AI 对话能力优化 v0.1
- 输出日期：2026-04-15
- 输出文件：`docs/功能拆分与技术方案/fastnote-功能拆分与技术方案-总览-AI对话能力优化-2026-04-15.md`
- 输入来源：
  - `docs/需求文档/AI对话能力PRD-2026-04-15.md`
  - `docs/需求文档/AI对话能力-代码反推-2026-04-15.md`
  - 当前仓库代码（分支/commit）：当前工作区未额外固定 commit
- 输出范围：
  - AI 对话入口与上下文装配优化
  - AI 笔记工具执行器接入
  - 确认执行链路与结构化返回接入
  - 本地会话持久化模型升级
- 不在范围：
  - 服务端代理与密钥托管改造
  - 新模型接入平台与计费策略
  - 长期摘要/记忆层建设

## 2. 功能拆分总览

| 能力域 | 功能点 | 用户问题/价值 | 优先级 | 当前状态（已支持/部分支持/未支持） | 关键证据 |
| ------ | ------ | ------------- | ------ | ---------------------------------- | -------- |
| AI 对话入口 | F1.1 保持首页统一入口并升级为上下文感知对话 | 用户已能聊天，但当前入口不读取笔记上下文，回答与 fastnote 业务弱绑定 | P0 | 部分支持 | `fastnote/src/features/global-search/ui/global-search.vue:30` |
| 对话编排 | F1.2 接入 AI 工具会话与确认执行 | 仓库已有工具执行器与确认会话，但未接入现有 AI 面板 | P0 | 部分支持 | `fastnote/src/processes/ai-chat-session/model/use-ai-chat-session.ts:21` |
| 数据操作 | F1.3 复用现有笔记写接口完成创建/更新/移动/删除/锁定 | 需要在不破坏 offline-first 的前提下让 AI 真正执行笔记操作 | P0 | 部分支持 | `fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:161` |
| 返回协议 | F1.4 接入结构化预览/执行结果/失败反馈 | 当前 AI 面板只展示纯文本，无法承载确认与执行回执 | P1 | 未支持 | `fastnote/src/features/ai-chat/ui/ai-chat-panel.vue:173` |
| 会话持久化 | F1.5 从纯文本持久化升级为结构化会话模型 | 后续接入工具调用后，当前持久化会丢 preview/result 等结构信息 | P1 | 未支持 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts:90` |
| 安全治理 | F1.6 浏览器直连模式的安全边界与后续迁移位 | 当前本地保存 API Key，需明确短期接受范围与长期替代方案 | P1 | 部分支持 | `fastnote/src/features/ai-chat/ui/ai-chat-settings-card.vue:21` |

## 3. 模块文档索引

| 模块 | 文档文件 | 功能点数量 | 负责人建议 | 备注 |
| ---- | -------- | ---------- | ---------- | ---- |
| AI 对话能力优化 | `fastnote-功能拆分与技术方案-AI对话能力优化-2026-04-15.md` | 6 | 前端主责，产品/测试参与评审 | 先做入口接线与结构化回执，不先做服务端代理 |

## 4. 里程碑与发布建议

- 里程碑划分：
  - M1（P0）：打通 AI 面板与 `ai-note-command` / `ai-chat-session`，支持搜索、读详情、创建、更新、移动、删除的预览与执行。
  - M2（P1）：接入结构化响应 schema、结构化持久化与失败回执。
  - M3（P1）：补安全治理与可观测性，评估是否进入服务端代理模式。
- 上线策略：
  - 建议先保留现有纯聊天入口能力，新增“工具执行实验链路”并以可开关配置控制。
  - 首次上线只开放 `search_notes`、`get_note_detail`、`create_note`、`update_note`、`move_note`、`delete_note`。
- 灰度/回滚：
  - 若结构化响应解析失败率高，可回退到纯文本聊天模式。
  - 若笔记工具执行异常率高，可保留 AI 面板但关闭工具执行路径，只保留问答模式。

## 5. 跨模块依赖与风险

- 依赖关系：
  - 入口与面板：`features/global-search`、`features/ai-chat`
  - 工具执行：`features/ai-note-command`
  - 确认会话：`processes/ai-chat-session`
  - 现有本地写能力：`features/note-write`、`features/note-move`、`features/note-delete`、`features/note-lock`
  - offline-first 真相源：`entities/note/model/state/note-store.ts`
- 关键风险：
  - 当前模型链路仍是 OpenAI-compatible 纯文本流，若直接要求模型返回 JSON/工具调用，解析脆弱性会显著上升。
  - 结构化会话落地前，预览/执行结果无法可靠恢复。
  - 浏览器直连模式下的 API Key 本地保存风险仍未解决。
- 需要业务决策的问题：
  - 是否接受首期仍保留浏览器直连。
  - 首期开放哪些可执行动作。
  - 高风险删除是否必须二次确认，阈值如何定义。

## 6. 附录：证据索引

| 证据ID | 代码位置 | 摘要 |
| ------ | -------- | ---- |
| E1 | `fastnote/src/features/global-search/ui/global-search.vue:30-39` | 首页入口同时挂接全局搜索与 AI 对话 |
| E2 | `fastnote/src/features/global-search/ui/global-search.vue:301-317` | AI 模式提交时只调用 `sendAiMessage()` 发送纯文本 |
| E3 | `fastnote/src/features/ai-chat/model/use-ai-chat.ts:90-157` | 当前只持久化用户/助手纯文本消息 |
| E4 | `fastnote/src/features/ai-chat/model/openai-compatible-chat-transport.ts:143-180` | 当前请求只发送系统提示词与纯文本消息 |
| E5 | `fastnote/src/features/ai-note-command/model/use-ai-note-command.ts:257-399` | 工具执行器已支持搜索、读详情、创建、更新、移动、删除、锁定 |
| E6 | `fastnote/src/processes/ai-chat-session/model/use-ai-chat-session.ts:30-57` | 确认会话已支持预览、待确认缓存、确认后二次执行 |
| E7 | `fastnote/src/entities/note/model/state/note-store.ts:306-337` | 现有本地搜索已支持树内递归匹配标题和正文 |
| E8 | `fastnote/src/features/note-write/model/use-note-write.ts:94-175` | 现有写接口已处理标题/摘要/版本冲突/父目录计数 |
| E9 | `fastnote/src/features/ai-chat/ui/ai-chat-settings-card.vue:21-23` | 当前显式提示“浏览器直连模式，API Key 保存在本地浏览器” |
