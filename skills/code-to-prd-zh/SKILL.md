---
name: code-to-prd-zh
description: 从现有代码仓库反向抽取业务能力、用户流程、规则约束并生成中文 PRD 草案的技能。用于接手存量项目、重构前需求澄清、模块盘点、功能补文档，或需要把代码实现对齐为可评审需求文档（范围、用户故事、验收标准、非功能要求、风险与未决问题）时使用。
---

# 代码转 PRD（中文）

## 快速开始

1. 确定 PRD 范围：`全产品`、`单模块` 或 `单功能`。
2. 扫描代码证据：优先看路由、页面、状态、接口、数据模型、权限与校验。
3. 建立“证据 -> 需求”映射：每条关键需求至少绑定 1 条代码证据。
4. 按 `references/prd-template-zh.md` 输出 PRD 草案。
5. 明确标注“代码事实”和“推断假设”，避免把猜测写成既定需求。

## 工作流

### 1) 锁定范围与对象

- 明确目标读者：产品、研发、测试、运营。
- 明确交付粒度：版本级 PRD 或功能级 PRD。
- 明确边界：写清不在本次 PRD 的范围项。

### 2) 收集代码证据

- 优先读取以下信号源：
  - 路由定义、导航守卫、页面入口
  - 页面/组件交互代码
  - store/service/repository 业务动作
  - API 契约（请求参数、返回结构、错误码）
  - 数据模型与数据库 schema
  - 权限、校验、feature flag、配置常量
- 优先使用快速命令定位证据：

```bash
rg --files
rg "router|routes|path|beforeEach|guard" src
rg "create|update|delete|submit|sync|publish|share" src
rg "api|request|fetch|axios|endpoint" src
rg "role|permission|auth|token|401|403" src
rg "schema|model|type|interface|zod|yup|validate" src
```

- 给每条证据分配编号：`E1`、`E2`、`E3`。

### 3) 从实现反推需求

- 使用 `references/code-to-requirement-signals.md` 将代码信号转成需求语言。
- 先抽取“用户目标与任务”，再抽取“系统行为与约束”。
- 把规则拆到可测试粒度：
  - 触发条件
  - 系统响应
  - 失败分支
  - 边界条件

### 4) 组装 PRD

- 使用 `references/prd-template-zh.md` 作为唯一输出骨架。
- 每条核心需求后追加证据引用：`[证据: E2, E5]`。
- 对无直接证据的内容统一标注：`[假设]` 并写入“未决问题”。

### 5) 质量校验

- 保证“可验收”：每条验收标准可由测试直接执行。
- 保证“可追溯”：关键段落能回链到代码证据。
- 保证“一致性”：术语、状态名、角色名与代码命名一致。
- 若证据冲突，优先保留冲突说明，不强行定论。

## 输出规则

- 默认输出中文。
- 优先输出结构化 Markdown。
- 明确区分三种信息：
  - `代码事实`：可直接定位到代码。
  - `推断`：由多条证据归纳得到。
  - `待确认`：无法从代码确定、需要业务方确认。
- 禁止编造不存在于代码或证据链中的业务指标、流程或角色权限。

## 参考资料

- `references/prd-template-zh.md`：PRD 标准模板
- `references/code-to-requirement-signals.md`：代码信号映射表
