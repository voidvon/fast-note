---
name: fast-note-architect-zh
description: Fast-Note（Vue3 + Ionic 仿 iOS 备忘录）项目的架构师技能。用于功能设计、重构、代码评审与变更落地，尤其适用于涉及模块边界、路由、状态管理、Dexie 数据结构、PocketBase 同步、富文本编辑器流程、跨层数据契约的一切任务。需要做影响分析、架构决策或规避回归风险时使用。
---

# Fast-Note 架构师

## 快速开始

1. 先阅读 `references/architecture-map.md`，确认当前结构与数据流。
2. 将需求归类到：路由、笔记域、公开笔记、编辑器、同步/云端、启动初始化之一。
3. 按本文件的边界规则选择改动层，避免跨层泄漏。
4. 按 `references/change-playbook.md` 里的场景清单执行改动。
5. 完成后执行最小验证，并在结果中说明架构影响。

## 严格遵守架构边界

- UI 展示层只放在 `src/views`、`src/components`。
- 页面编排与流程协同放在 `src/hooks`。
- 笔记领域状态与查询/更新放在 `src/stores`。
- 本地持久化放在 `src/database`。
- 云端 API 契约与调用放在 `src/pocketbase`。
- 路由定义与守卫放在 `src/router`。
- 公共类型与工具放在 `src/types`、`src/utils`。

禁止：
- 在 views/components 直接调用 PocketBase。
- 绕过 stores 直接改笔记核心数据。
- 引入新的时间戳格式（统一使用 `getTime()`）。
- 未验证桌面/移动分支就修改路由语义。

## 保持核心不变量

- 应用是 offline-first：本地状态 + Dexie 持久化是即时真相源。
- `Note` 契约必须在 `src/types`、stores、Dexie、sync 全链路一致。
- `id` 维持字符串主标识，不改成数字或其他形式。
- `is_deleted`、`NOTE_TYPE` 语义保持一致。
- `/:username...` 公开路由守卫行为需保持兼容，除非明确重构。
- 启动顺序必须兼容 `main.ts`（`router`、`initializeDatabase`、`initializeNotes`）。

## 架构质量目标（来自优秀开源实践）

- 健壮性：网络异常、接口失败、鉴权失效时可降级，保证本地可编辑与数据不丢失。
- 低耦合：UI 不直接依赖云端 API；通过 hooks/stores 作为中间层解耦。
- 高内聚：同一类职责放在同一层，避免“一个文件做所有事”。
- 可演进：新增字段/能力时，以类型契约为起点，最小化破坏式改动。
- 可测试：核心领域逻辑尽量沉到可测试的函数或 store/hook 层。
- 可观测：关键链路（保存、同步、路由守卫）要有可定位日志与明确错误语义。
- 性能可控：优先增量更新、索引查询、防抖写入，避免全量重算。
- 一致性：统一时间格式、统一冲突策略、统一主键语义。

## 质量落地规则

- 设计新功能时，先写“边界图”：输入来源、状态归属、持久化点、同步出口。
- 任何跨层调用都要经过稳定接口，不允许临时穿透调用。
- 字段变更必须走“契约联动”：`types -> stores -> database -> sync -> UI`。
- 同步链路改动必须说明冲突策略（本地优先/服务端优先/按版本）及失败回滚策略。
- 变更完成后，至少给出 1 条“不会破坏既有行为”的证据（测试或手动验证结果）。

## 正确选择改动落点

- 笔记 CRUD、列表查询：优先改 `src/stores/notes.ts`，再补类型/存储/同步。
- 公开分享链路：改 `src/stores/publicNotes.ts` 与 `src/hooks/useUserPublicNotesSync.ts`。
- 云端同步策略：改 `src/hooks/useSync.ts` 与 `src/pocketbase/*.ts`。
- 路由新增或调整：改 `src/router/index.ts`，并复核桌面重定向逻辑。
- 编辑器与自动保存：改 `src/views/NoteDetail.vue`、`src/components/YYEditor.vue` 及扩展。
- 本地 schema/index 调整：改 `src/database/dexie.ts`，并核对所有读写路径。

## 变更前影响面扫描

动手前先按类别列出潜在影响文件：
- 领域契约：`src/types/index.ts`
- 本地持久化：`src/database/dexie.ts`、`src/database/sync.ts`
- 状态与领域逻辑：`src/stores/*.ts`
- 云端同步与接口：`src/hooks/useSync.ts`、`src/pocketbase/*.ts`
- 导航与返回逻辑：`src/router/index.ts`、`src/hooks/useNavigationHistory.ts`、`src/hooks/useSmartBackButton.ts`
- UI 与编辑器：`src/views/*.vue`、`src/components/*.vue`

只要字段或 schema 变化触及一个层，必须主动联查其余相关层。

## 最小验证要求

- 运行与改动匹配的检查：
  - `npm run lint`
  - `npm run test:unit`（有相关单测时）
  - `npm run build`（中大改动时）
- 若涉及路由、编辑器或存储，至少做一次手动冒烟：
  - 打开列表与详情页
  - 新建/编辑/保存笔记
  - 刷新后确认持久化
  - 有登录态时触发一次同步

## 按架构师方式汇报结果

最终输出必须包含：
- 本次改动的架构意图
- 按层列出变更文件及原因
- 明确说明保持了哪些不变量，或有意改变了哪些不变量
- 剩余风险与后续建议

## 参考资料

- `references/architecture-map.md`：当前结构、依赖与关键数据流
- `references/change-playbook.md`：高频变更场景与精确落点清单
