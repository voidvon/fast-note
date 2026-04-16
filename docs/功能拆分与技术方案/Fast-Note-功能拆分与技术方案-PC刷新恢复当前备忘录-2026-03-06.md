# PC 模式刷新恢复当前备忘录技术方案（fastnote）

## 1. 文档信息

- 功能名称：PC 模式刷新后保持当前打开备忘录
- 输出日期：2026-03-06
- 输出文件：`docs/功能拆分与技术方案/fastnote-功能拆分与技术方案-PC刷新恢复当前备忘录-2026-03-06.md`
- 需求来源：用户新增需求“在 PC 模式下，打开一个备忘录之后，刷新页面在中间栏和右侧详情可以保持刚刚打开的内容”
- 关联模块：桌面分栏导航、路由恢复、首页选中状态持久化
- 不在范围：移动端深链恢复、未保存草稿恢复、编辑器滚动位置/光标位置恢复、跨设备同步当前打开项

## 2. 迁移结论

- 当前状态：部分支持。
- 架构结论：桌面首页的“文件夹 + 笔记”恢复能力已经从旧 `hooks` 方案稿迁入 `processes/navigation` 与 `pages/home`；但它仍是桌面页内状态恢复，不是完整的私有路由延迟恢复方案。
- 代码证据：
  - `E1` `src/app/router/index.ts:13`：桌面端命中私有详情路径时仍会被统一重定向到 `/home`，说明桌面刷新恢复不能依赖 `/n/:id` 深链。
  - `E2` `src/processes/navigation/model/use-desktop-active-note.ts:5`：桌面当前选中上下文已使用 `flashnote_desktop_active_note_v1` 持久化。
  - `E3` `src/processes/navigation/model/use-desktop-active-note.ts:115`：`resolveDesktopActiveNoteSelection()` 已实现“快照命中则恢复，目标失效则降级到目录首条笔记或空态”。
  - `E4` `src/pages/home/ui/home-page.vue:189`：`persistDesktopSelection()` 会在桌面端把 `folderId`、`noteId`、`parentId` 回写到本地快照。
  - `E5` `src/pages/home/ui/home-page.vue:201`：`restoreDesktopSelection()` 会在初始化时读取快照并恢复 `state.folerId/state.noteId/state.parentId`。
  - `E6` `src/pages/home/ui/home-page.vue:236`：目录切换时会清空旧选中与快照，再重新走 `init()`，避免文件夹与详情错位。
  - `E7` `src/pages/home/ui/home-page.vue:248`：笔记切换时会自动持久化真实笔记 ID；`noteId === '0'` 的新建草稿不会被保存。
  - `E8` `src/pages/home/ui/home-page.vue:300`：`init({ preferPersistedSelection: true })` 已把“优先恢复快照，失败再走默认兜底”接入页面进入流程。
  - `E9` `src/processes/navigation/model/use-last-visited-route.ts:15`：`isDeferredPrivateRoute()` 已将私有 `/n/:id`（排除 `/n/0`）归入 deferred 恢复分支。
- 现状结论：桌面端刷新后恢复当前打开笔记的主链路已可工作，但它只覆盖 `/home` 分栏内部选中状态，不覆盖未保存草稿、私有详情延迟恢复和跨设备场景。

## 3. 当前恢复链路

1. 桌面首页在用户选择文件夹或笔记后，由 `pages/home` 维护 `state.folerId/state.noteId/state.parentId`。
2. 选中真实笔记时，`persistDesktopSelection()` 会把当前上下文写入本地快照。
3. 页面重新进入时，`init({ preferPersistedSelection: true })` 先尝试 `restoreDesktopSelection()`。
4. `processes/navigation` 中的 `resolveDesktopActiveNoteSelection()` 负责验证快照是否仍然有效。
5. 若目标笔记已失效但目录仍有效，则降级到目录首条笔记；若目录也无效，则清空快照并退回默认首页状态。

## 4. 按层落点

### 4.1 `app`

- `src/app/router/index.ts`
  - 继续保留桌面私有详情重定向到 `/home` 的规则。
  - 该文件只负责路由装配与守卫，不承担桌面分栏内部恢复逻辑。

### 4.2 `processes`

- `src/processes/navigation/model/use-desktop-active-note.ts`
  - 承担桌面选中快照的本地契约、校验、归一化、降级恢复。
  - 已经替代旧文档中“建议新增 hook”的状态，当前真实落点在 `processes/navigation`。
- `src/processes/navigation/model/use-last-visited-route.ts`
  - 仍只保存最后访问路径。
  - 延迟恢复私有路由的判定还没有启用，因此不能把它当成桌面刷新恢复的完整实现。

### 4.3 `pages`

- `src/pages/home/ui/home-page.vue`
  - 负责把恢复逻辑接入页面初始化、目录切换、笔记切换和新建草稿分支。
  - 页面层只编排恢复时机，不定义快照校验规则。

## 5. 真实边界与剩余限制

- 仅桌面端首页分栏模式支持该恢复能力，移动端仍按路由详情页语义工作。
- 真实笔记 ID 才会持久化；`noteId === '0'` 的新建草稿不会恢复，这是当前有意保留的行为。
- 当没有快照，或者快照目录失效时，页面会退回默认可用态，而不是强行保留失效上下文。
- `getDefaultNoteId()` 仍只对 `allnotes` 和 `deleted` 做默认首条兜底，因此“没有快照的自定义文件夹刷新”仍可能进入右侧空态。
- `use-last-visited-route` 的 deferred 判定已经启用，但它服务的是私有详情恢复时序，不改变桌面 `/home` 分栏快照仍是 PC 刷新恢复主链这一事实。
- 当前已经有 `useDesktopActiveNote`、桌面首页恢复兜底，以及 `allnotes / 文件夹` 两类刷新恢复的单测和集成测试；后续若继续调整路由恢复时机，仍需补更贴近真实私有路由恢复的验证。

## 6. 迁移状态说明

- 迁移结果：已建立目标架构内的正式实现，但整体完成度仍为“部分支持”。
- 当前迁移口径：
  - 桌面当前激活 note 的恢复能力已经收口到 `src/processes/navigation/model/use-desktop-active-note.ts`。
  - 首页只负责消费桌面恢复结果并装配分栏页面状态，不再承担散落的恢复规则。
  - 当前真实语义应描述为“通过桌面页内快照恢复 `/home` 分栏上下文”，不是“通过路由深链恢复桌面详情”。
- 后续仍可继续迁移和补强的点：
  - 为桌面恢复链路补单测/集成测试。
  - 评估是否需要覆盖“自定义文件夹无快照时的默认选中策略”。
