# Framework7 迁移状态

## 当前结论

前端 UI 已切换为 Vue 3 + Framework7 Vue 9 单运行时，统一使用 iOS 主题。Ionic Vue、Ionic Vue Router、Ionicons、Vue Router、Ionic CSS 与 `Ion*` 页面组件已从直接依赖和生产源码中移除。应用页面栈和浏览器历史由 Framework7 Router 管理。

## 已完成

- 应用根节点改为 `F7App -> F7View`，页面出口使用 Framework7 Router 和 `Router.RouteParameters[]`。
- 移动端路由页统一输出 `F7Page -> F7Navbar + F7PageContent + F7Toolbar`标准结构。
- 桌面三栏仅保留一个路由 `F7Page`，内嵌文件夹和详情区使用普通 pane，避免嵌套 `.page` 干扰 F7 尺寸计算。
- 页面、导航栏、工具栏、列表、表单、弹层、加载状态和手势入口已迁移为 Framework7 或应用级 `F7*` 组件。
- 图标统一改用 Lucide Vue，不再依赖 Ionicons。
- 主题切换改用 `app-theme-dark`，颜色统一使用应用 token 和 Framework7 token。
- 滚动记忆、长按列表和弹层锁清理已迁移到通用 Framework7 工具。
- Framework7 Virtual List 验证页保留，可用于大列表滚动与筛选验证。
- E2E 选择器已改为 `.page`、`.page-content` 和 `.app-*`，并增加运行 DOM 中不存在 `ION-*` 元素的检查。

## 数据与架构边界

- Dexie 仍是客户端即时真相源。
- PocketBase 同步协议、删除语义、附件按需加载和编辑保存流程未改变。
- 页面和 UI 组件仍通过现有 feature/entity 接口访问业务数据，不直接操作 Dexie 或 PocketBase SDK。

## 验证状态

- `npm run build`：通过。
- Framework7 虚拟列表、移动路由页结构、F7 Router 站内导航和桌面单路由页结构：3 个 Cypress 用例通过。
- 生产源码和直接依赖扫描：无 Ionic、Ionicons 或 Vue Router 引用。
- 完整 Vitest 当前为 367/418 通过；剩余失败主要是测试桩仍模拟已移除的 Vue Router/旧 F7 兼容导出，需继续迁移测试基础设施。

## 剩余验收

- 在真实移动端核验返回导航、键盘与安全区。
- 在桌面端核验三栏布局、拖拽调整与编辑器工具栏。
- 将 Vitest 中的 Vue Router 模拟改为 Framework7 Router 适配状态模拟。
- 执行完整 Cypress E2E，并重点检查弹层、公开路由、滚动恢复和附件流程。
