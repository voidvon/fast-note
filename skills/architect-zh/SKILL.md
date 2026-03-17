---
name: architect-zh
description: Fast-Note 项目的中文架构师技能。以 FSD + DDD 为目标架构，用于功能设计、重构、代码评审与变更落地，尤其适用于模块拆分、领域建模、同步链路治理、路由编排、编辑器流程与跨层数据契约治理。
---

# 架构师（FSD + DDD）

## 快速开始

1. 先阅读 `references/architecture-map.md`，确认目标分层、限界上下文与旧目录映射。
2. 先判断需求属于哪个 FSD 层：`app`、`processes`、`pages`、`widgets`、`features`、`entities`、`shared`。
3. 再判断变更命中哪个领域上下文：`note`、`public-note`、`auth`、`sync`、`editor`、`navigation`。
4. 按本文件的边界规则选择改动落点，优先补齐实体、用例、仓储端口，再接 UI 和基础设施。
5. 按 `references/change-playbook.md` 的场景清单执行改动，并在收尾时说明架构影响与迁移状态。

## 严格遵守 FSD + DDD 边界

### FSD 顶层职责

- `src/app`：应用启动、全局 provider、路由装配、应用级初始化。
- `src/processes`：跨页面、长生命周期流程，例如启动初始化、同步编排、公开笔记初始化。
- `src/pages`：路由页，只做页面装配，不承载核心业务规则。
- `src/widgets`：多个 feature/entity 组合而成的业务 UI 模块。
- `src/features`：面向用户动作的应用用例，如编辑笔记、移动笔记、登录、同步触发。
- `src/entities`：领域实体、聚合、值对象、领域规则、仓储端口、实体级状态模型。
- `src/shared`：跨领域复用的 UI、工具、配置、基础设施适配器、通用类型。

### DDD 领域规则

- 领域模型优先放在 `entities/*/model/domain`，保持纯 TypeScript，不直接依赖 Vue、Ionic、Dexie、PocketBase。
- 应用用例优先放在 `features/*/model` 或 `processes/*/model`，负责编排实体与仓储，不承载底层实现细节。
- 仓储端口、领域服务接口紧贴实体定义；仓储实现放在 `shared` 基础设施层或对应 slice 的 `api`/`infra`。
- 页面和组件只能通过 feature/widget/entity 的公开 API 交互，不能穿透到数据库或云端 SDK。
- 一个业务规则只在一个上下文里定义一次，避免在页面、store、adapter 中复制语义。

## 禁止事项

- 在 `pages`、`widgets`、`components` 直接调用 Dexie、PocketBase 或其他远端 SDK。
- 把领域规则直接写进 Vue 组件、路由守卫或数据库适配器。
- 绕过 feature/entity 公共 API 直接改领域状态。
- 在多个模块重复定义 `Note`、`SyncState`、公开笔记可见性等核心语义。
- 新增与既有规范不一致的时间格式；统一保持毫秒时间戳语义。
- 未验证桌面/移动分支与公开路由兼容性就修改导航语义。

## 保持核心不变量

- 应用仍然是 offline-first：本地状态与本地持久化是即时真相源，云端同步是最终一致性补偿。
- `Note` 主标识继续使用字符串 `id`，不改为数字或其他编码方式。
- `is_deleted`、`NOTE_TYPE`、公开路由 `/:username...` 的既有语义保持兼容，除非需求明确要求重构。
- 启动顺序必须兼容 `main.ts`：路由、数据库初始化、笔记初始化仍需可安全启动与降级。
- 富文本编辑器、同步、公开笔记链路都必须遵循同一份领域契约，不能出现分叉 DTO。

## 架构质量目标

- 低耦合：UI 依赖 feature/entity 暴露的接口，不直接依赖数据库与云端实现。
- 高内聚：领域规则、应用编排、基础设施适配分别归位，不把一个文件做成“全能层”。
- 可迁移：允许旧目录渐进迁移，但所有新增逻辑按目标层级落位。
- 可替换：仓储和外部服务通过端口隔离，Dexie 或 PocketBase 可局部替换。
- 可测试：领域对象、用例、冲突策略优先沉到纯函数或可注入依赖的模型层。
- 可观测：保存、同步、路由守卫、初始化链路具备可定位日志与清晰错误语义。
- 性能可控：保留增量更新、索引查询、防抖写入，避免全量重算。

## 质量落地规则

- 设计新能力时，先画出“层级路径”：页面入口、feature 用例、entity 规则、仓储端口、基础设施实现。
- 字段变更必须走“契约联动”：`entity domain -> repository port -> local/remote adapter -> feature use case -> widget/page`。
- 同步链路改动必须明确冲突策略、失败回滚策略与本地优先边界。
- 重构旧目录时，先建立公开 API，再迁移调用方，最后清理旧实现，避免大爆炸改造。
- 任何跨上下文调用都要通过显式接口，不允许临时 import 内部文件穿透。
- 变更完成后，至少给出 1 条“不会破坏既有行为”的证据，来源可以是测试或手动验证。

## 正确选择改动落点

- 笔记 CRUD、列表查询、树结构规则：优先进入 `entities/note` 与对应 `features/note-*`。
- 公开分享链路：优先进入 `entities/public-note`、`features/public-note-*`、`processes/public-notes-sync`。
- 云端同步策略：优先进入 `processes/sync-notes`，仓储端口在 `entities`，实现落在基础设施层。
- 路由新增或调整：放到 `src/app/router`，并复核桌面重定向与公开路由守卫。
- 编辑器与自动保存：编辑器领域规则放到 `features/note-editor`，复杂展示放到 `widgets/editor`。
- 本地 schema 或索引调整：先改仓储实现，再回查所有依赖该仓储的 feature/process。

## 变更前影响面扫描

动手前先按层列出潜在影响：

- `app`：`src/main.ts`、`src/router/*`、全局初始化与 provider
- `processes`：启动、同步、公开笔记初始化、导航恢复
- `features`：用户动作用例、命令/查询编排、表单状态
- `entities`：`Note`、公开笔记、用户、同步水位等领域模型与仓储端口
- `shared`：Dexie、PocketBase、日志、时间工具、通用 UI
- `pages/widgets`：页面装配、业务组件、编辑器容器

只要契约或流程变化触及一层，必须主动联查其依赖链上下游。

## 最小验证要求

- 运行与改动匹配的检查：
  - `npm run lint`
  - `npm run test:unit`（有相关单测时）
  - `npm run build`（中大改动或目录迁移时）
- 若涉及路由、编辑器、同步或存储，至少做一次手动冒烟：
  - 打开列表与详情页
  - 新建、编辑、保存笔记
  - 刷新后确认持久化
  - 有登录态时触发一次同步
  - 验证桌面与移动分支、公开路由行为未回归

## 按架构师方式汇报结果

最终输出必须包含：

- 本次改动的架构意图
- 按 FSD 层列出变更文件及原因
- 说明保持了哪些不变量，或有意改变了哪些不变量
- 当前改动是“已迁入目标架构”还是“为后续迁移建立过渡层”
- 剩余风险与后续建议

## 参考资料

- `references/architecture-map.md`：目标 FSD + DDD 架构、上下文划分与旧目录映射
- `references/change-playbook.md`：高频变更场景、推荐落点与验证步骤
