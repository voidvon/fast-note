# 技能与应用内 MCP

## 1. 背景

本次约束很明确：fastnote 的 Agent 只在网页里运行，所以这里不需要把 MCP 理解成独立进程、外部服务器或桌面桥接。

在这个项目里，更准确的定义应该是：

- 技能：面向任务类型的可复用执行模板
- 应用内 MCP：面向 Agent 暴露的受控方法调用协议

也就是说，模型不是直接操作 store，而是通过一层受控的方法目录去调用应用能力。

## 2. 先定义两个概念

### 2.1 技能

技能是“某一类任务的稳定打法”。

一个技能至少应包含：

- 适用意图
- Prompt 补充约束
- 允许调用的方法集合
- 风险边界
- 结果收口格式

例子：

- 笔记改写技能
- 链接读取技能
- 目录整理技能
- 会议纪要提炼技能

### 2.2 应用内 MCP

应用内 MCP 是“Agent 可调用的方法注册表”。

每个方法不只是一段函数，还应带上：

- 方法名
- 描述
- 输入 Schema
- 输出 Schema
- 风险级别
- 是否需要确认
- 执行器

这样模型看到的是“能力契约”，而不是底层实现细节。

## 3. 为什么不能继续只靠默认系统提示词

当前很多规则都放在默认系统提示词里，这有几个问题：

- 能力边界散在一长段文本里，不可维护。
- 新增一个任务类型时，容易把 Prompt 越堆越大。
- 无法按任务动态裁剪方法白名单。
- 无法清楚表达“这个任务为什么能调这些方法，不能调那些方法”。

所以技能层和应用内 MCP 层需要独立出来。

## 4. 应用内 MCP 的建议结构

### 4.1 方法注册对象

建议统一为下面这种结构：

```ts
interface AiAppMethodDefinition<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  riskLevel: 'none' | 'low' | 'medium' | 'high'
  requiresConfirmation: boolean
  inputSchema: unknown
  outputSchema: unknown
  execute: (input: TInput) => Promise<TOutput>
}
```

### 4.2 当前可纳入注册表的方法

基于现有工具，首批方法可以直接来自：

- `search_notes`
- `get_note_detail`
- `list_folders`
- `create_note`
- `update_note`
- `move_note`
- `delete_note`
- `set_note_lock`

这些方法已经存在，只是还没有以统一注册表形式暴露。

### 4.3 方法分组建议

为了后续技能裁剪，建议按组管理：

- `read`：搜索、读取、列目录
- `write`：创建、更新
- `organize`：移动、重命名、整理
- `secure`：加锁、解锁

## 5. 技能层的建议结构

### 5.1 技能定义对象

建议技能至少表达下面这些信息：

```ts
interface AiAgentSkillDefinition {
  id: string
  title: string
  description: string
  whenToUse: string[]
  allowedMethods: string[]
  systemPromptAppendix?: string
  outputMode: 'answer_only' | 'tool_then_answer' | 'tool_then_confirm'
}
```

### 5.2 推荐首批技能

可以先从高频任务抽 4 个技能：

- `note_rewrite`
  - 适用：改写、润色、精简、续写
  - 方法：`get_note_detail`, `update_note`
- `note_reader`
  - 适用：读取链接、阅读当前笔记、提炼正文
  - 方法：`get_note_detail`
- `note_search_and_summary`
  - 适用：搜索某类笔记并总结
  - 方法：`search_notes`, `get_note_detail`
- `note_organizer`
  - 适用：移动到目录、整理结构、归类
  - 方法：`search_notes`, `list_folders`, `move_note`

## 6. 技能与应用内 MCP 的关系

它们不是一回事：

- 应用内 MCP 决定“系统有哪些方法”
- 技能决定“这次任务该用哪些方法、怎么用、输出成什么样”

可以理解成：

- MCP 是能力目录
- 技能是调用策略

## 7. 运行时选择流程

建议运行时按下面顺序工作：

1. 识别用户意图
2. 结合当前目标对象和风险判断选择技能
3. 根据技能裁剪可用方法集合
4. 生成本轮系统附加约束
5. 让模型在受控方法范围内决定是否调用方法
6. 执行方法并把结构化结果回流

如果没有命中技能，也应该回退到默认技能，而不是直接失控。

## 8. 安全边界

这层设计的重点不是“方便模型随便调”，而是“让模型只能调受控能力”。

需要明确的边界：

- 模型不能直接读写 note store。
- 模型不能自己拼出未注册的方法。
- 高风险方法必须经过注册表和确认策略双重限制。
- 技能不能绕过风险分级。

## 9. 与当前实现的衔接

当前可以直接复用的部分：

- 工具类型：`fastnote/src/shared/types/ai-note-tools.ts`
- 工具执行器：`fastnote/src/features/ai-note-command/model/use-ai-note-command.ts`
- 风险策略：`fastnote/src/features/ai-chat/model/mutation-policy.ts`

下一步建议新增：

- `method-registry.ts`
- `skill-registry.ts`
- `skill-selector.ts`
- `method-execution-adapter.ts`

## 10. 首期实现建议

为了避免一次性做太重，建议按下面顺序落地：

1. 先把现有 8 个工具包成统一的方法注册表。
2. 再补 3 到 4 个显式技能定义。
3. 再把系统提示词里和工具使用有关的规则拆到技能层。
4. 最后才考虑是否扩到更复杂的多技能联动。

如果当前阶段只打算做“更规范的工具调用”，而不做技能和完整 MCP，可优先参考：

- `05-工具调用标准协议.md`
