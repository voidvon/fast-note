# PC 空白详情点击新建备忘录技术方案（Fast-Note）

## 1. 文档信息

- 功能名称：PC 空白详情区点击启动新建备忘录
- 输出日期：2026-03-06
- 输出文件：`doc/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-PC空白详情点击新建备忘录-2026-03-06.md`
- 需求来源：用户新增需求“当备忘录没有被选中时，此时右侧的详情是空的，点击空白处可以启动新建备忘录的编辑器，类似点击中间栏的新建备忘录按钮，并聚焦到富文本中”
- 关联模块：桌面分栏导航、笔记详情入口、新建保存链路
- 不在范围：移动端新建交互改版、默认标题策略调整、编辑器工具栏改版、保存/同步机制重构

## 2. 迁移结论

- 当前状态：已支持。
- 架构结论：该能力已经从旧 `views` 形态迁入 `pages/home`、`pages/note-detail`、`features/note-detail-entry` 与 `features/note-save` 的分层组合，不再是待实施方案。
- 代码证据：
  - `E1` `src/pages/home/ui/home-page.vue:164`：`showDesktopEmptyDetailOverlay` 仅在桌面端且 `state.noteId` 为空时展示空白详情创建层。
  - `E2` `src/pages/home/ui/home-page.vue:334`：`handleCreateNote(parentId)` 复用既有新建入口，直接写入 `parentId`、把 `noteId` 置为 `'0'`，并清理桌面选中快照。
  - `E3` `src/pages/home/ui/home-page.vue:471`：桌面详情区同时挂载 `NoteDetail` 与空态 overlay；overlay 点击直接调用 `handleCreateNote()`。
  - `E4` `src/pages/note-detail/ui/note-detail-page.vue:223`：详情页监听 `idFromSource`，当值为 `'0'` 时转入 `noteDetailEntry.openNewDraft()`。
  - `E5` `src/features/note-detail-entry/model/use-note-detail-entry.ts:28`：`openNewDraft()` 负责生成草稿 ID、重置锁态与缺失态，再进入新建草稿态。
  - `E6` `src/pages/note-detail/ui/note-detail-page.vue:164`：`enterNewDraft()` 会清空当前详情数据、记录新草稿 ID，并在 `nextTick()` 后切到编辑器新建态。
  - `E7` `src/pages/note-detail/ui/note-detail-page.vue:216`：`effectiveUuid` 在新建草稿生成后生效，编辑器按该 ID 正常挂载，后续保存链路沿用现有实现。
- 现状结论：桌面端右侧空白详情点击新建、进入编辑器、继续保存为真实笔记的链路已经落地，且与底部“新建备忘录”按钮共用同一套入口。

## 3. 真实用户流程

1. 用户在桌面端首页切换到没有选中笔记的状态，`state.noteId` 为空，右侧显示空白详情创建层。
2. 点击空白详情区后，`pages/home` 只做页面编排，复用 `handleCreateNote()` 把 `noteId` 切到 `'0'`。
3. `pages/note-detail` 收到 `'0'` 后，不直接在页面里写草稿规则，而是委托 `features/note-detail-entry` 生成草稿态。
4. 编辑器挂载后进入新建内容输入态，用户继续输入并保存时，仍走 `features/note-save` 的既有新增笔记链路。
5. 真正保存成功后，`HomePage` 通过 `noteSaved` 事件把当前选中 ID 更新为真实笔记 ID。

## 4. 架构落点

### 4.1 `pages`

- `src/pages/home/ui/home-page.vue`
  - 负责桌面分栏页面编排。
  - 控制右侧空白详情 overlay 的显示条件和点击入口。
  - 不直接处理编辑器实例和聚焦细节。
- `src/pages/note-detail/ui/note-detail-page.vue`
  - 负责详情页入口判定。
  - 根据 `props.noteId` 或路由参数识别“现有笔记 / 新建草稿 / 空选择”三种状态。

### 4.2 `features`

- `src/features/note-detail-entry/model/use-note-detail-entry.ts`
  - 统一详情进入逻辑。
  - 处理新建草稿 ID 生成、锁态复位、缺失态复位。
- `src/features/note-save/model/use-note-save.ts`
  - 继续承担“首轮真实保存时创建 Note 实体、后续走更新”的保存编排。
  - 本次能力没有引入第二套新建保存逻辑。

### 4.3 `processes`

- `src/processes/navigation/model/use-desktop-active-note.ts`
  - 桌面空白详情点击新建时会清理选中快照，避免把未保存草稿误当作可恢复详情。

### 4.4 `entities` / `shared`

- `entities/note` 的 `Note` 契约未变化。
- `shared` 层未新增数据库、同步或路由契约。

## 5. 行为边界与剩余约束

- 当前仅在桌面端首页分栏的右侧详情空态生效，移动端仍通过路由 `/n/0` 进入新建。
- 空白详情点击后只进入草稿态，不会立即落库；未输入有效内容时不会创建空笔记。
- `noteId === '0'` 的草稿态不会写入桌面恢复快照，因此刷新页面不会恢复未保存草稿。
- 当前已经有空白详情点击新建的单测与集成测试；后续若调整桌面详情布局或编辑器挂载时序，仍需补更贴近真实编辑器实例的回归验证。

## 6. 迁移状态说明

- 迁移结果：已迁入目标架构。
- 当前迁移口径：
  - 桌面空白详情点击后的页面编排已经稳定落在 `src/pages/home/ui/home-page.vue`。
  - 详情页展示和编辑入口继续由 `src/pages/note-detail/ui/note-detail-page.vue` 承接。
  - 当前真实语义应描述为“页面编排交给 `pages`，草稿进入交给 `features/note-detail-entry`”，而不是由 `HomePage` 自己处理全部新建聚焦逻辑。
- 本能力当前不需要新增过渡层；后续只需补测试与必要的体验回归说明。
