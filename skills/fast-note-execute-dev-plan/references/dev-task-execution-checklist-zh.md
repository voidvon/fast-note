# 开发执行检查清单（Fast-Note）

## 1. 任务选择

- 是否已锁定 `任务ID`。
- 是否确认依赖任务状态。
- 是否确认任务验收标准可执行。

## 2. 代码实现

- 是否仅修改与任务相关模块。
- 是否遵守 `UI -> features/processes -> entities -> shared` 的前端边界。
- 若涉及后端，是否只改 `backend` 宿主相关目录。
- 是否避免引入无关重构。

## 3. 自动化测试

- `P0` 是否已新增/更新自动化测试。
- 是否存在 `任务ID -> 用例ID -> 测试文件` 对应关系。
- 是否更新了三向映射中的覆盖状态。

## 4. 质量校验

- 是否执行 `cd fastnote && npm run lint`。
- 是否执行 `cd fastnote && npm run test:unit -- --run`。
- 是否执行 `cd fastnote && npm run build`。
- 若需要，是否执行 `cd fastnote && npm run test:e2e`。

## 5. 文档回写

- 是否更新看板任务状态。
- 是否更新测试计划覆盖状态。
- 是否记录未决问题与阻塞项。
