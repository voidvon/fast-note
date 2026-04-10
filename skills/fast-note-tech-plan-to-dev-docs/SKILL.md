---
name: fast-note-tech-plan-to-dev-docs
description: 将 Fast-Note 的“功能拆分与技术方案”文档转换为开发执行文档（迭代计划与任务看板、组件与数据契约清单、测试与发布计划）。当用户提出“从方案到开发排期/任务拆解/组件设计/测试发布落地”类需求，或需要把 `docs/功能拆分与技术方案/` 产物转为可执行研发计划时使用。
---

# Fast-Note 方案转开发文档（中文）

## 快速开始

1. 读取输入文档：
   - `docs/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-总览-*.md`
   - `docs/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-<模块名>-*.md`
2. 按模块抽取：功能点、任务拆分、验收标准、风险、未决问题。
3. 输出 3 份开发文档到 `docs/开发计划/`：
   - `迭代计划与任务看板.md`
   - `组件与数据契约清单.md`
   - `测试与发布计划.md`
4. 用 `references/delivery-quality-checklist-zh.md` 做交付前自检。

## 工作流

### 1) 明确输入范围与版本

- 优先使用最新日期的总览文档作为基线。
- 若同一模块存在多个版本，默认选择日期最新版本。
- 缺少模块文档时，允许从总览先输出骨架并标记 `[待补充]`。

### 2) 生成《迭代计划与任务看板》

- 使用 `references/dev-iteration-board-template-zh.md`。
- 把模块级任务拆成可分配项（任务 ID、负责人角色、依赖、风险、验收标准）。
- 按 `P0/P1/P2` 排优先级，并标注里程碑（M1/M2/M3）。

### 3) 生成《组件与数据契约清单》

- 使用 `references/component-data-contract-template-zh.md`。
- 强制覆盖这些层：`fastnote/pages/widgets`、`fastnote/features/processes`、`fastnote/entities`、`fastnote/shared`、`backend`、`router`。
- 对每个功能点沉淀：输入/输出、字段变化、事件、状态源、失败处理。

### 4) 生成《测试与发布计划》

- 使用 `references/test-release-plan-template-zh.md`。
- 关联每个任务的测试类型（单测/集成/冒烟/回归）与发布/回滚动作。
- 高风险改动必须给出“监控指标 + 回滚触发条件”。
- 自动化优先规则：
  - `P0` 任务必须有自动化测试（至少单测或集成测试之一）。
  - `P1` 任务默认要求自动化；若无法自动化需写明原因与补救计划。
  - `P2` 任务可手工优先，但需给出后续自动化候选项。

### 5) 跨文档一致性检查

- 编号一致：`模块-功能-任务` 编号在三份文档可互相追踪。
- 依赖一致：跨模块依赖在看板与发布计划保持一致。
- 验收一致：任务验收标准与测试用例映射一致。

## 拆解规则

- 任务粒度：可在 0.5~2 天内完成为宜。
- 负责人粒度：用角色占位（前端/后端/测试/产品），不臆造真实姓名。
- 未知信息处理：统一使用 `[待确认]`，并在“阻塞项”集中列出。
- 禁止把“推断”写成“代码事实”。
- 自动化测试粒度：
  - 每个任务至少映射 1 个测试用例 ID。
  - 每个测试用例必须映射到测试文件路径（规划路径亦可）。
  - 每个高优任务必须声明 CI 门禁级别（阻断/非阻断）。

## Fast-Note 约束（输出时必须体现）

- 保持 offline-first：本地数据为即时真相源。
- UI 不直接调 PocketBase，核心数据改动必须经过 FSD 分层编排。
- `Note` 契约变化必须同步写入“组件与数据契约清单”。
- 同步相关改动必须声明冲突策略与失败补偿。

## 输出规则

- 默认输出中文 Markdown。
- 默认输出目录：`docs/开发计划/`（不存在先创建）。
- 默认输出文件（固定 3 份）：
  - `docs/开发计划/迭代计划与任务看板.md`
  - `docs/开发计划/组件与数据契约清单.md`
  - `docs/开发计划/测试与发布计划.md`
- 若用户要求“保留历史快照”，再额外输出日期版副本（如 `*-YYYY-MM-DD.md`）。
- 若输入证据不足，必须在对应章节写明“信息不足 + 待确认项”。
- 测试计划中必须包含可执行命令与通过标准（例如 `cd fastnote && npm run test:unit`、`cd fastnote && npm run test:e2e`）。

## 推荐检索命令

```bash
find docs/功能拆分与技术方案 -maxdepth 1 -type f | sort
rg "任务ID|验收标准|风险|未决问题|里程碑" docs/功能拆分与技术方案
rg "pages|widgets|features|processes|entities|shared|backend|pocketbase|router" docs/功能拆分与技术方案
```

## 参考资料

- `references/dev-iteration-board-template-zh.md`：迭代计划与任务看板模板
- `references/component-data-contract-template-zh.md`：组件与数据契约模板
- `references/test-release-plan-template-zh.md`：测试与发布计划模板
- `references/delivery-quality-checklist-zh.md`：交付检查清单
