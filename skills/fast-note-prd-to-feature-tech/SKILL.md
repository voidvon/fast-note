---
name: fast-note-prd-to-feature-tech
description: 基于 fastnote 的代码反推 PRD 与当前仓库代码，产出中文“功能拆分 + 技术方案”文档并落盘到 `docs/功能拆分与技术方案/`，默认按“总览 + 分模块”多文件交付。用于版本规划、迭代评审、重构前设计、开发任务拆解，或当用户提出“功能拆分/技术方案/实施方案/从 PRD 到研发落地”类需求时使用。
---

# fastnote 功能拆分与技术方案（中文）

## 快速开始

1. 读取 `docs/需求文档/fastnote-PRD-代码反推-2026-03-04.md`，提取功能域与业务目标。
2. 扫描当前仓库代码，建立“PRD 条目 -> 代码证据”的映射。
3. 按能力域输出“功能拆分 + 技术方案 + 实施任务 + 验收标准”。
4. 使用 `references/feature-tech-plan-template-zh.md` 生成总览文档。
5. 使用 `references/feature-tech-plan-module-template-zh.md` 生成模块文档。
6. 选择输出模式（默认多文件；仅在用户明确要求单文件时合并输出）。
7. 将文档写入 `docs/功能拆分与技术方案/`。
8. 使用 `references/quality-checklist-zh.md` 做交付前自检。

## 工作流

### 1) 明确范围与交付对象

- 确定范围：`全量版本`、`单模块` 或 `单功能`。
- 确定交付对象：产品、研发、测试、架构评审。
- 明确不在范围的内容，防止方案膨胀。

### 2) 拆分功能结构

- 从 PRD 提取能力域（一级）。
- 每个能力域下拆分功能点（二级）。
- 每个功能点继续拆到可开发、可测试的原子任务（三级）。
- 每个原子任务必须有唯一标识（如 `F1.2.3`）。

### 3) 建立证据链

- 每个功能点至少绑定 1 条可定位代码证据（文件 + 行号）。
- 优先从这些层收集证据：
  - `src/views`、`src/components`（交互入口）
  - `src/hooks`（流程编排）
  - `src/stores`（领域状态）
  - `src/database`（本地持久化）
  - `src/pocketbase`（云端契约）
  - `src/router`（路由与守卫）
- 区分三类信息：
  - `代码事实`：代码可直接证明
  - `推断`：由多条证据归纳
  - `待确认`：代码无法确认，需业务决策

### 4) 设计技术方案（逐功能点）

- 先写目标与约束，再写改动落点，最后写实施任务。
- 强制按层给出变更点：
  - UI：`views/components`
  - 编排：`hooks`
  - 领域：`stores`
  - 持久化：`database`
  - 云端：`pocketbase`
  - 路由：`router`
- 明确数据契约影响：字段、索引、同步策略、冲突处理。
- 明确失败与回滚策略：网络失败、鉴权失败、同步冲突、数据迁移失败。

### 5) 输出文档并自检

- 严格使用模板章节顺序：
  - 总览文档：`references/feature-tech-plan-template-zh.md`
  - 模块文档：`references/feature-tech-plan-module-template-zh.md`
- 所有核心结论都要能回链到证据。
- 总览文档必须包含模块文档索引与相对路径链接。
- 输出前执行 `references/quality-checklist-zh.md` 全项检查。

## fastnote 架构约束（必须遵守）

- 保持 offline-first：本地状态与 Dexie 为即时真相源。
- 保持模块边界：UI 不直接调用 PocketBase，不绕过 store 改核心数据。
- 保持 `Note` 契约一致：`types -> stores -> database -> sync -> UI` 联动。
- 保持主键语义：`id` 维持字符串标识。
- 保持时间字段规范：统一使用 `getTime()` 生成。
- 同步改动必须说明冲突策略与失败补偿策略。

## 推荐检索命令

```bash
rg --files
rg "router|beforeEach|redirect|username" src/router src/views
rg "addNote|updateNote|deleteNote|getNotesByUpdated" src/stores src/hooks
rg "sync|upload|download|pocketbase|collection\\('notes'\\)" src/hooks src/pocketbase
rg "Dexie|db\\.value|schema|notes" src/database src/stores
```

## 输出规则

- 默认输出中文 Markdown。
- 强制输出目录：`docs/功能拆分与技术方案/`（若不存在先创建）。
- 默认产物形态：`多文件`。
  - 总览：`fastnote-功能拆分与技术方案-总览-YYYY-MM-DD.md`
  - 分模块：`fastnote-功能拆分与技术方案-<模块名>-YYYY-MM-DD.md`
- 多文件拆分原则：
  - 以能力域/模块为最小文件单位（例如编辑器、笔记管理、同步、设置）。
  - 每个模块文件只覆盖一个模块，避免跨模块混写。
  - 总览文件保留里程碑、优先级与跨模块依赖，不重复粘贴模块细节。
- 仅在用户明确要求“单文件交付”时，输出：
  - `fastnote-功能拆分与技术方案-YYYY-MM-DD.md`
- 每个功能点必须包含：目标、现状、改造点、技术方案、任务拆分、验收标准。
- 禁止输出无法从证据链支持的“确定性结论”。
- 对未确认事项统一落到“未决问题”。

## 参考资料

- `references/feature-tech-plan-template-zh.md`：总览文档模板
- `references/feature-tech-plan-module-template-zh.md`：分模块技术方案模板
- `references/quality-checklist-zh.md`：交付质量检查清单
