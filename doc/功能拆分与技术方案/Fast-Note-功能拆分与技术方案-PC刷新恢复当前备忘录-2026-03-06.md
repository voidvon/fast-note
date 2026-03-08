# PC 模式刷新恢复当前备忘录技术方案（Fast-Note）

## 1. 文档信息

- 功能名称：PC 模式刷新后保持当前打开备忘录
- 输出日期：2026-03-06
- 输出文件：`doc/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-PC刷新恢复当前备忘录-2026-03-06.md`
- 需求来源：用户新增需求“在 PC 模式下，打开一个备忘录之后，刷新页面在中间栏和右侧详情可以保持刚刚打开的内容”
- 关联模块：路由与导航、笔记编辑与组织
- 不在范围：移动端深链恢复、未保存草稿恢复、编辑器滚动位置/光标位置恢复、跨设备同步当前打开项

## 2. 目标与现状

- 业务目标：在 PC 分栏模式下，页面刷新后仍恢复到用户刚刚查看的文件夹/笔记上下文，减少重新定位成本。
- 当前状态：部分支持。
- 代码证据：
  - `E1` `src/router/index.ts:77`：桌面端访问 `/n/*`、`/f/*` 会被统一重定向到 `/home`，说明详情上下文不能依赖桌面 URL 持续表达。
  - `E2` `src/views/HomePage.vue:131`：PC 首页状态仅在内存 `state.folerId/state.noteId/state.parentId` 中维护，刷新后会丢失。
  - `E3` `src/views/HomePage.vue:147`：切换文件夹时会清空当前选中的笔记，说明中栏/右栏联动以 `HomePage` 本地状态为主。
  - `E4` `src/views/HomePage.vue:161`：初始化逻辑仅在 `deleted`/`allnotes` 两种目录下自动兜底选中第一条笔记，未处理“恢复上次打开项”。
  - `E5` `src/views/NoteDetail.vue:66`：详情页优先读取 `props.noteId`，桌面端完全可以由父层注入恢复后的 noteId 驱动详情恢复。
  - `E6` `src/components/NoteList.vue:48`：当前已经用 `localStorage` 持久化左栏展开态，但没有持久化当前选中的文件夹与笔记。
  - `E7` `src/hooks/useLastVisitedRoute.ts:13`：现有“最后访问路由”能力只保存 `fullPath`，对桌面 `/home` 场景不足以恢复分栏内部选中状态。
- 现状结论：当前桌面端刷新后会保留进入 `/home`，但不会保留 `/home` 内部的文件夹选中态和笔记选中态，因此中间栏与右侧详情会退回默认状态。

## 3. 设计原则与推荐方案

### 3.1 设计原则

- 保持 offline-first：恢复依据优先使用本地 `notes` store / Dexie 数据，不依赖远端返回。
- 保持边界清晰：详情恢复属于页面编排与本地 UI 状态持久化，不改 `Note` 领域模型，不写入 PocketBase。
- 保持降级可恢复：当上次选中的笔记不存在时，页面仍可进入默认可用态。
- 保持桌面语义稳定：不改变现有桌面访问 `/n/*`、`/f/*` 重定向 `/home` 的规则。

### 3.2 方案对比

#### 方案 A：依赖 URL 深链恢复

- 思路：刷新后通过 `/n/:id` 或 `/f/:id` 直接还原上下文。
- 优点：可分享，可回放。
- 缺点：与当前桌面端重定向规则冲突，改动路由语义大，回归风险高。
- 结论：本次不采用。

#### 方案 B：在本地持久化桌面首页选中上下文（推荐）

- 思路：在 PC 模式下把 `folderId + noteId + parentId + timestamp` 存入 `localStorage`，`HomePage` 初始化后优先恢复该上下文。
- 优点：改动集中在 `HomePage` / `hooks` / 少量列表联动，不影响既有移动端路由语义。
- 缺点：仅在当前浏览器生效，无法跨设备恢复。
- 结论：推荐实施。

## 4. 详细技术方案

### 4.1 状态模型

- 新增本地持久化键：`flashnote_desktop_active_note_v1`
- 建议数据结构：

```ts
interface DesktopActiveNoteSnapshot {
  folderId: string
  noteId: string
  parentId: string
  savedAt: number
}
```

- 字段说明：
  - `folderId`：当前中栏所属目录，可能为 `allnotes` / `unfilednotes` / `deleted` / 真实文件夹 ID
  - `noteId`：当前右栏详情笔记 ID；若为 `'0'` 则不持久化
  - `parentId`：新建笔记场景的父目录，仅在需要继续新建流时使用；本期建议仅对已存在笔记恢复，`'0'` 不恢复
  - `savedAt`：用于排查与未来过期策略扩展

### 4.2 恢复时机

- 页面进入 `HomePage` 且 `isDesktop=true` 后执行一次恢复。
- 依赖 `initializeNotes()` 已完成，`notes` store 可读。
- 恢复顺序：
  1. 读取本地快照。
  2. 校验 `folderId` 和 `noteId` 是否仍有效。
  3. 先恢复 `state.folerId`，再恢复 `state.noteId`。
  4. 若恢复失败，再走现有 `init()` 的默认兜底逻辑。

### 4.3 写入时机

- 在 PC 模式下发生以下动作时持久化：
  - 左栏选择目录后，更新 `folderId`
  - 中栏选择笔记后，更新 `noteId`
  - 新建笔记成功后，更新 `noteId`
- 不写入场景：
  - `noteId === ''`
  - `noteId === '0'`
  - 当前不在桌面模式

### 4.4 校验与降级策略

- `noteId` 存在且笔记仍可访问：按快照恢复。
- `noteId` 不存在但 `folderId` 仍有效：恢复文件夹后，自动选择该文件夹下第一条有效笔记。
- `folderId` 已失效：清除快照并回退到 `allnotes` + 首条有效笔记。
- `deleted` 目录下若目标笔记已不在最近删除列表：清除 `noteId`，按 `DeletedPage` 当前默认规则选择第一条。
- 若当前无任何可选笔记：保留目录选中，右侧详情为空态。

## 5. 架构落点（按层）

### 5.1 UI 层

- `src/views/HomePage.vue`
  - 增加“恢复桌面上下文”的初始化流程。
  - 将 `@selected` 的内联赋值收敛为显式处理函数，便于统一持久化。
  - 保持 `FolderPage` 和 `NoteDetail` 仍由 `state.folerId/state.noteId` 驱动。

### 5.2 Hooks 层

- 建议新增 `src/hooks/useDesktopActiveNote.ts`
  - `getSnapshot()`
  - `saveSnapshot(payload)`
  - `clearSnapshot()`
  - `isRestorableSnapshot(payload)`
- 原因：与 `useLastVisitedRoute.ts` 区分开，避免把“路由恢复”和“桌面页内状态恢复”混在一起。

### 5.3 Stores 层

- `src/stores/notes.ts`
  - 不新增持久化字段。
  - 仅复用已有 `getNote` 与列表数据计算结果做恢复校验。

### 5.4 Database 层

- `src/database/dexie.ts`
  - 无改动。

### 5.5 PocketBase 层

- 无改动。

### 5.6 Router 层

- `src/router/index.ts`
  - 不改变桌面 `/n/*`、`/f/*` -> `/home` 规则。
  - 无需增加新路由。

## 6. 关键实现步骤

### 6.1 `HomePage` 初始化改造

- 在 `onIonViewWillEnter` / `onMounted` 阶段增加一次 `restoreDesktopSelection()`。
- `restoreDesktopSelection()` 逻辑建议：
  1. 非桌面端直接返回。
  2. 读取快照；若不存在则返回 `false`。
  3. 校验目录有效性；无效则清理快照并返回 `false`。
  4. 赋值 `state.folerId`。
  5. 校验笔记有效性；有效则赋值 `state.noteId` 并返回 `true`。
  6. 若笔记无效，则按目录默认策略重选第一条笔记并回写快照。

### 6.2 选择行为改造

- 把以下内联事件改为函数：
  - 左栏目录选择：`handleFolderSelected(id)`
  - 中栏笔记选择：`handleNoteSelected(id)`
  - 新建笔记成功：`handleNoteSaved(event)` 内补快照回写
- 这样可以保证用户每次切换后，刷新都恢复到最近一次有效状态。

### 6.3 空态与失效处理

- 如果恢复的 `noteId` 指向已删除/已移动笔记：
  - 先尝试按 `folderId` 重选第一条；
  - 若目录内为空，则保留 `folderId`，右侧展示空态；
  - 清理失效快照中的 `noteId`。

## 7. 数据契约与兼容性

- 新增本地契约：`DesktopActiveNoteSnapshot`
- 存储介质：`localStorage`
- 版本策略：使用 `_v1` 后缀，后续若扩展字段可平滑升级
- 兼容性：
  - 老用户首次进入时没有快照，走现有逻辑
  - 新快照异常或 JSON 解析失败时，静默清理并回退默认逻辑

## 8. 任务拆分

| 任务ID   | 优先级 | 任务描述                                             | 变更文件                                                                                                  | 负责人角色 | 依赖     | 风险 |
| -------- | ------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------- | -------- | ---- |
| T-FN-019 | P1     | 新增桌面当前笔记快照 hook，封装读写/清理/校验逻辑    | `src/hooks/useDesktopActiveNote.ts`                                                                       | 前端       | 无       | 低   |
| T-FN-020 | P1     | `HomePage` 接入恢复与回写流程，统一目录/笔记选择处理 | `src/views/HomePage.vue`                                                                                  | 前端       | T-FN-019 | 中   |
| T-FN-021 | P1     | 补充桌面刷新恢复单测/集成测试，覆盖失效降级场景      | `tests/unit/views/home-desktop-restore.spec.ts`, `tests/integration/home/desktop-refresh-restore.spec.ts` | 前端+测试  | T-FN-020 | 中   |

## 9. 验收标准

- AC-001：桌面端在 `allnotes` 中打开笔记 A 后刷新，左栏仍选中 `allnotes`，中栏仍选中 A，右栏仍显示 A 内容。
- AC-002：桌面端在文件夹 F 中打开笔记 B 后刷新，左栏仍选中 F，中栏仍选中 B，右栏仍显示 B 内容。
- AC-003：若快照中的笔记已删除或不可见，页面不报错，并降级到当前目录首条可用笔记或空态。
- AC-004：若快照数据损坏或 JSON 解析失败，页面仍按当前默认逻辑进入可用态。
- AC-005：移动端刷新行为不受本次改动影响。

## 10. 测试方案

### 10.1 单元测试

- `tests/unit/hooks/useDesktopActiveNote.spec.ts`
  - 正常保存/读取/清理快照
  - 异常 JSON 回退
  - `'0'` / 空 noteId 不保存

### 10.2 组件/集成测试

- `tests/unit/views/home-desktop-restore.spec.ts`
  - 初始化读取快照后恢复 `folerId/noteId`
  - 快照失效时回落到首条笔记
- `tests/integration/home/desktop-refresh-restore.spec.ts`
  - 模拟用户点击目录与笔记 -> 刷新 -> 校验中栏与详情恢复

### 10.3 手工冒烟

- 场景 1：`allnotes` 打开笔记刷新
- 场景 2：自定义文件夹打开笔记刷新
- 场景 3：最近删除打开笔记刷新
- 场景 4：删除已记录笔记后刷新
- 场景 5：切到移动宽度后刷新，确认不走桌面快照恢复

## 11. 风险与待确认

### 11.1 风险

- R1：`HomePage` 当前通过多个内联事件直接改状态，若不收敛到统一写入口，快照容易遗漏更新。
- R2：文件夹与笔记可能在刷新前后发生删除/移动，若恢复顺序不当会出现“中栏选中 A、右栏显示空”的瞬态不一致。
- R3：后续若引入桌面 URL 深链，本地快照恢复与 URL 恢复可能出现优先级冲突。

### 11.2 待确认

- Q1：是否需要恢复“新建未保存笔记”状态；当前方案默认不恢复 `noteId='0'`。
- Q2：当目标笔记不存在时，默认降级到“当前目录首条笔记”是否符合产品预期。
- Q3：是否需要顺带恢复中栏滚动位置；当前方案默认不做。

## 12. 结论

- 推荐采用“桌面首页选中上下文本地持久化”方案。
- 该方案不触碰 `Note` 契约、不改 Dexie schema、不改 PocketBase，同步与回滚风险低。
- 研发落点集中、验证路径清晰，适合作为 P1 体验增强项在当前架构下快速落地。
