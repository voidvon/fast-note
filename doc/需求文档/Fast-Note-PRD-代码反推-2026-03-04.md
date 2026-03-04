# Fast-Note 产品需求文档（代码反推版）

## 1. 文档信息

- 文档标题：Fast-Note 产品需求文档（代码反推）
- 版本：v0.1-draft
- 日期：2026-03-04
- 作者：Codex（基于仓库代码自动生成）
- 代码范围（目录/模块）：`src/**`、`package.json`
- 证据覆盖说明：覆盖路由、页面、状态管理、本地数据库、同步、认证、公开访问、富文本编辑、附件、实时连接等核心链路

## 2. 背景与问题陈述

- 当前能力概述（代码事实）：
  - 产品是一个 Ionic + Vue3 的备忘录应用，支持移动端与桌面端分栏模式。[证据: E1, E36]
  - 数据以本地 Dexie 为核心持久化，并在登录后对接 PocketBase 做增量同步与实时更新。[证据: E4, E7, E25, E28]
  - 提供私有笔记编辑、文件夹组织、回收站、公开分享、登录注册、全文搜索、附件插入等能力。[证据: E12, E13, E14, E18, E19, E21, E33]
- 当前痛点或机会点：
  - `[待确认]` 业务目标、核心 KPI、目标用户规模未在代码中体现。
  - `[代码事实]` 扩展系统在代码中标记为“已废弃”，但页面仍保留扩展渲染入口，存在认知与实现不一致风险。[证据: E39]
- 本次文档目标：将已实现行为沉淀成可评审、可验收、可追溯的 PRD 草案，支持后续产品规划、测试设计与重构对齐。

## 3. 目标与非目标

### 3.1 目标

- G1：定义“本地优先 + 云同步”的备忘录核心流程与约束。
- G2：明确私有与公开访问两条用户路径的功能边界。
- G3：输出可测试的验收标准，并绑定代码证据。

### 3.2 非目标

- NG1：不定义全新商业策略与运营指标（代码无直接证据）。
- NG2：不包含后端数据库迁移脚本与运维部署手册。
- NG3：不覆盖扩展系统新能力设计（当前实现已标注废弃）。[证据: E39]

## 4. 用户与使用场景

- 用户角色 R1：访客（未登录）
  - 可浏览公开用户的公开文件夹与公开笔记。[证据: E1, E3, E32]
- 用户角色 R2：注册用户（登录态）
  - 可创建/编辑/删除/恢复/移动自己的笔记与文件夹，并执行同步。[证据: E12, E13, E15, E19, E20, E29]
- 用户角色 R3：内容发布者
  - 可将笔记或文件夹设为公开，并影响父级公开状态继承逻辑。[证据: E18]

## 5. 范围定义

### 5.1 In Scope

- I1：路由与导航（首页、文件夹、笔记详情、回收站、登录注册、公开用户页面）。[证据: E1, E35, E37]
- I2：本地笔记域（Dexie 存储、Note 模型、文件夹树、删除保留、搜索）。[证据: E6, E7, E9, E10, E11, E33]
- I3：同步域（PocketBase 增量同步、冲突按更新时间处理、实时订阅、手动同步）。[证据: E25, E27, E28, E29]
- I4：安全与访问（认证、公开访问、生物识别锁定）。[证据: E21, E22, E23, E34]

### 5.2 Out of Scope

- O1：多租户组织、团队协作、共享编辑冲突协商 UI。
- O2：标签体系、统计分析看板（README 提及但代码证据不足）。
- O3：后端 PocketBase collection 结构文档（当前仅能从前端调用行为反推）。

## 6. 功能需求

### FR-001 路由与入口管理

- 用户价值：用户可在私有与公开场景中进入正确页面。
- 前置条件：应用已加载路由。
- 触发方式：访问 URL 或点击列表项。
- 主流程：
  - `/` 重定向到 `/home`。
  - 私有路径：`/home`、`/f/:path`、`/n/:id`、`/deleted`。
  - 公开路径：`/:username`、`/:username/f/:path`、`/:username/n/:noteId`。
- 异常流程：公开用户初始化失败时仅记录错误并继续导航。
- 业务规则：桌面端访问 `/n/*` 与 `/f/*` 时重定向到 `/home`。
- 数据变化：无直接业务数据写入。
- 权限要求：公开路径不要求登录；私有数据操作在后续 API 层受 authStore 约束。
- 依赖项：Vue Router + Ionic Router。
- 证据引用：[证据: E1, E2, E3, E37]
- 置信度：高

### FR-002 本地初始化与离线优先

- 用户价值：即使云端不可用，应用仍可打开并读取本地数据。
- 前置条件：浏览器可使用 IndexedDB。
- 触发方式：应用启动。
- 主流程：并行执行 `router.isReady` 与 `initializeDatabase + initializeNotes`，最终挂载应用。
- 异常流程：初始化失败时也执行 `app.mount` 避免白屏。
- 业务规则：本地 Dexie 是核心持久化介质。
- 数据变化：Dexie 打开/加载缓存。
- 权限要求：无。
- 依赖项：Dexie、store 初始化。
- 证据引用：[证据: E4, E7, E8]
- 置信度：高

### FR-003 文件夹与笔记组织

- 用户价值：用户可创建层级文件夹并按目录组织笔记。
- 前置条件：本地 store 可用。
- 触发方式：首页/文件夹页点击新增；列表点击进入。
- 主流程：
  - 支持新增文件夹（根目录或指定父目录）。
  - 支持“全部备忘录”“未归档备忘录”虚拟节点。
  - 维护文件夹 `note_count` 递归统计。
- 异常流程：`getNote` 获取失败时记录错误。
- 业务规则：`NOTE_TYPE.FOLDER=1`、`NOTE_TYPE.NOTE=2`。
- 数据变化：写入/更新 `notes` 表。
- 权限要求：私有上下文可编辑，公开上下文只读。
- 依赖项：`useNote`。
- 证据引用：[证据: E6, E9, E11, E12, E13]
- 置信度：高

### FR-004 笔记编辑与自动保存

- 用户价值：编辑内容自动保存，降低数据丢失风险。
- 前置条件：已进入笔记详情页。
- 触发方式：编辑器 `blur`、页面离开、笔记切换。
- 主流程：
  - 编辑器 800ms 防抖保存。
  - 新建笔记时自动分配 `id` 并创建记录。
  - 旧笔记更新 `title/summary/content/version/updated`。
- 异常流程：内容为空时删除该笔记记录。
- 业务规则：空标题回退为“新建备忘录”。
- 数据变化：更新 `notes` 与父级 `note_count`。
- 权限要求：公开笔记不可编辑。
- 依赖项：Tiptap 编辑器、`useNote`。
- 证据引用：[证据: E14, E15, E17]
- 置信度：高

### FR-005 删除、回收站与恢复

- 用户价值：支持软删除、恢复与永久删除。
- 前置条件：目标笔记存在。
- 触发方式：长按菜单或详情“更多”菜单。
- 主流程：
  - 删除时置 `is_deleted=1`。
  - 回收站仅展示 30 天内删除项。
  - “永久删除”通过写入极早 `updated` 时间触发后续同步清理。
- 异常流程：删除失败时保留当前状态。
- 业务规则：删除提示声明“最近删除保留 30 天”。
- 数据变化：更新 `is_deleted/updated`。
- 权限要求：仅私有上下文。
- 依赖项：`useNote`、同步逻辑。
- 证据引用：[证据: E10, E19]
- 置信度：高

### FR-006 公开分享与继承规则

- 用户价值：作者可公开分享并保证父级可访问路径完整。
- 前置条件：目标笔记存在。
- 触发方式：详情页“分享/取消分享”。
- 主流程：
  - 开启分享时：当前笔记 `is_public=true`，并递归将父级设为公开。
  - 取消分享时：当前笔记设私有；若父级无任何公开后代则父级回退私有。
- 异常流程：失败提示 toast。
- 业务规则：公开状态与层级结构联动。
- 数据变化：更新 `is_public/updated`。
- 权限要求：仅内容所有者。
- 依赖项：Dexie 查询父子关系。
- 证据引用：[证据: E18]
- 置信度：高

### FR-007 生物识别锁定（WebAuthn）

- 用户价值：敏感笔记可启用生物识别保护。
- 前置条件：浏览器支持 WebAuthn。
- 触发方式：详情页“锁定/移除”。
- 主流程：
  - 首次锁定触发注册凭据并存储 credential_id。
  - 已锁定笔记打开时执行验证，验证通过后可查看内容。
- 异常流程：不支持 WebAuthn 时提示用户。
- 业务规则：验证有效期 1 分钟，过期需重新验证。
- 数据变化：本地存储 `webauthn_*` 键。
- 权限要求：设备持有者。
- 依赖项：浏览器 PublicKeyCredential。
- 证据引用：[证据: E18, E34]
- 置信度：高

### FR-008 认证与会话管理

- 用户价值：用户可注册、登录、退出并保持会话。
- 前置条件：PocketBase 服务可用。
- 触发方式：登录/注册页面提交。
- 主流程：
  - 登录：邮箱+密码。
  - 注册：用户名+邮箱+密码+确认密码，注册后自动登录。
  - 初始化：优先读取本地 authStore，再 `authRefresh` 验证。
- 异常流程：输入校验失败或后端错误，返回可读错误信息。
- 业务规则：注册页前端密码长度 >= 8、邮箱格式校验。
- 数据变化：PocketBase authStore token 与 user。
- 权限要求：鉴权接口受 token 约束。
- 依赖项：`authManager`、`authService`。
- 证据引用：[证据: E21, E22, E23]
- 置信度：高

### FR-009 双向同步与冲突处理

- 用户价值：多端数据最终一致，减少手工导入导出。
- 前置条件：已登录（非静默模式必须登录）。
- 触发方式：自动会话同步、保存后静默同步、用户手动同步。
- 主流程：
  - 拉取本地和云端 `updated > lastUpdated` 变更。
  - 以 `updated` 时间戳比较决定上传/下载。
  - 软删除记录超过 30 天触发本地或云端清理。
  - 同步结果返回上传/下载/删除计数。
- 异常流程：单条同步失败即中断并抛错。
- 业务规则：静默模式未登录返回 `null`，不弹错。
- 数据变化：`localStorage.pocketbaseUpdated` 游标更新。
- 权限要求：云端查询按 `user_id=authStore.model.id` 过滤。
- 依赖项：`notesService`、`useSync`。
- 证据引用：[证据: E24, E25, E27, E29]
- 置信度：高

### FR-010 附件处理与富文本引用

- 用户价值：可在笔记中插入图片/文件并跨端访问。
- 前置条件：编辑器可用。
- 触发方式：详情页工具栏选择文件。
- 主流程：
  - 本地插入：计算文件 SHA256，存入 `note_files`，在富文本中写入 hash。
  - 同步上传：将 hash 临时替换为占位符，上传后回填 PocketBase 文件名。
  - 读取显示：hash 从本地加载，文件名从 PocketBase URL 加载。
- 异常流程：本地文件缺失时跳过上传并记录警告。
- 业务规则：同一文件多次引用去重上传。
- 数据变化：`note_files` 表与 `notes.files/content`。
- 权限要求：受笔记访问权限控制。
- 依赖项：Tiptap 自定义 FileUpload、`filesService`。
- 证据引用：[证据: E26]
- 置信度：高

### FR-011 公开用户主页与公开内容浏览

- 用户价值：访客可按用户名访问公开内容。
- 前置条件：用户名有效。
- 触发方式：访问 `/:username` 系列路由。
- 主流程：
  - 根据用户名读取 `public_users`。
  - 拉取该用户公开笔记并构建文件夹树。
  - 支持下钻到公开文件夹和公开笔记详情（只读）。
- 异常流程：用户不存在或加载失败时展示错误态。
- 业务规则：每个公开用户在本地有独立 Dexie 数据库缓存。
- 数据变化：`UserPublicNotes_{username}` 本地库。
- 权限要求：公开内容无需登录。
- 依赖项：`usersService`、`notesService.getPublicNotes`。
- 证据引用：[证据: E3, E30, E31, E32]
- 置信度：中

### FR-012 搜索与导航体验

- 用户价值：快速定位历史笔记并优化返回行为。
- 前置条件：本地笔记已加载。
- 触发方式：首页搜索框输入；页面返回。
- 主流程：
  - 全局搜索 300ms 防抖，递归搜索内容匹配项。
  - 导航历史持久化，返回按钮优先回到真实上一页。
  - 记录并恢复“最后访问路由”（排除登录/注册）。
- 异常流程：存储失败时静默处理。
- 业务规则：历史长度上限 15。
- 数据变化：`localStorage` 中导航记录与最后路由。
- 权限要求：无。
- 依赖项：`useNavigationHistory`、`useLastVisitedRoute`。
- 证据引用：[证据: E33, E35]
- 置信度：高

## 7. 非功能需求

- 性能：
  - 笔记查询使用 `Map` 索引优化 `getNote/getNotesByParentId` 查找。
  - 本地持久化同步防抖 300ms，编辑保存防抖 800ms，搜索防抖 300ms。[证据: E9, E8, E14, E33]
- 可用性：
  - 启动失败仍挂载页面；未登录可本地编辑并静默跳过同步。[证据: E4, E24]
- 安全与权限：
  - PocketBase 请求依赖 authStore；私有同步按 `user_id` 过滤。
  - 锁定笔记使用 WebAuthn，验证有过期控制。[证据: E23, E27, E34]
- 数据一致性：
  - 以 `updated` 时间戳为主要冲突裁决；删除保留 30 天策略在本地与同步侧一致体现。[证据: E10, E25]
- 可观测性（日志/监控/告警）：
  - 关键链路包含 `console` 与 `logger` 日志，但暂无统一远程监控上报。[证据: E5, E25, E28]
- 兼容性（平台、版本、浏览器）：
  - Ionic iOS 模式；移动/桌面阈值 640px；WebAuthn 仅支持兼容浏览器。[证据: E36, E34]

## 8. 数据与接口

### 8.1 核心数据对象

- 对象名：`Note`
- 字段与约束：`id/title/content/item_type/parent_id/updated/is_deleted/is_locked/is_public/note_count/files...`
- 生命周期：新建 -> 编辑（version+1）-> 软删除（回收站）-> 超期清理/永久删除。
- 证据引用：[证据: E6, E9, E10, E15, E25]

- 对象名：`NoteFile`
- 字段与约束：`hash` 主键，包含 `file/fileName/fileType/fileSize/created/updated`。
- 生命周期：插入附件时写入，后续可按 hash 查询与清理。
- 证据引用：[证据: E7, E26]

### 8.2 外部/内部接口

- 接口名：`authService`
- 输入：登录/注册参数、当前 token。
- 输出：`success/user/token/error`。
- 错误码/失败语义：认证失败映射为中文错误文案。
- 幂等与重试要求：`getCurrentUser` 失败清理 authStore。
- 证据引用：[证据: E23, E38]

- 接口名：`notesService.getNotesByUpdated/updateNote/getPublicNotes`
- 输入：时间游标、note 数据、上传文件列表。
- 输出：变更列表、更新结果、公开笔记列表。
- 错误码/失败语义：查询失败抛错；`updateNote` 支持 create/update 回退。
- 幂等与重试要求：`auto/create/update` 模式下做 not found / already exists 回退。
- 证据引用：[证据: E27]

- 接口名：`filesService`
- 输入：noteId/hash/filename/file。
- 输出：文件 URL 或上传结果。
- 错误码/失败语义：未登录、无权限、文件不存在。
- 幂等与重试要求：读取失败返回 null，调用方降级处理。
- 证据引用：[证据: E26]

## 9. 验收标准

- AC-001（关联 FR-001）
  - Given 桌面端宽度 >= 640
  - When 访问 `/n/abc` 或 `/f/xxx`
  - Then 自动重定向到 `/home`

- AC-002（关联 FR-002）
  - Given Dexie 初始化报错
  - When 启动应用
  - Then 页面仍应挂载，不出现白屏

- AC-003（关联 FR-003）
  - Given 在某文件夹下创建子文件夹和笔记
  - When 返回列表
  - Then `note_count` 与层级展示应同步更新

- AC-004（关联 FR-004）
  - Given 打开一条已有笔记
  - When 修改内容并失焦
  - Then 800ms 内完成本地保存并更新 `updated`

- AC-005（关联 FR-005）
  - Given 执行删除操作
  - When 进入“最近删除”
  - Then 能看到 30 天内删除项，并可恢复/永久删除

- AC-006（关联 FR-006）
  - Given 子笔记开启分享
  - When 检查其父级链路
  - Then 父级应自动置为公开；取消后在无公开后代时回退私有

- AC-007（关联 FR-007）
  - Given 锁定笔记且设备支持 WebAuthn
  - When 未在验证有效期内打开笔记
  - Then 必须完成生物识别验证后才显示内容

- AC-008（关联 FR-009）
  - Given 本地与云端存在不同更新时间版本
  - When 执行同步
  - Then 以较新 `updated` 版本覆盖较旧版本

- AC-009（关联 FR-010）
  - Given 在富文本插入同一附件多次
  - When 执行同步上传
  - Then 文件仅上传一次，内容中的临时占位符替换为服务端文件名

- AC-010（关联 FR-011）
  - Given 访问 `/:username`
  - When 用户存在且有公开内容
  - Then 应展示该用户公开文件夹树并可进入只读详情

- AC-011（关联 FR-012）
  - Given 在首页输入搜索关键字
  - When 停止输入超过 300ms
  - Then 展示匹配笔记列表与结果数

- AC-012（关联 FR-012）
  - Given 已产生多步导航历史
  - When 点击返回按钮
  - Then 优先回到真实上一条历史，否则回退到业务 fallback 路径

## 10. 发布与回滚

- 发布策略：`[待确认]` 代码未体现正式环境发布流程（仅见 `vite build` / `tauri` 脚本）。
- 灰度策略：`[待确认]` 未见 feature flag 灰度框架。
- 回滚条件：
  - 同步失败率异常上升
  - 登录态恢复失败导致核心功能不可用
  - 笔记保存链路出现数据覆盖/丢失
- 回滚步骤（建议）：
  - 以前端版本回退为主（回退到上一稳定构建）
  - 暂时关闭自动同步入口（仅保留本地编辑）
  - 保留 Dexie 数据，不做客户端本地清库

## 11. 风险与未决问题

### 11.1 风险清单

- RISK-001：扩展系统实现标注“已废弃”，但首页仍尝试渲染扩展组件，可能造成功能认知偏差或无效 UI。
  - [证据: E39]
- RISK-002：公开页桌面布局中 `NoteDetail` 传参名为 `note-uuid`，而详情组件定义的是 `noteId`，可能导致公开详情无法正确加载。
  - [证据: E32]
- RISK-003：删除“文件夹”时目前仅处理一层子项软删，深层后代是否完整软删需要补充验证。
  - [证据: E19]
- RISK-004：`useDeviceType` 全局永久监听 resize，长期运行下需关注资源与副作用。
  - [证据: E36]

### 11.2 未决问题

- Q-001（产品负责人）：公开分享的权限边界是否仅限“作者自己切换”，是否需要二次确认与可见范围配置？
- Q-002（后端负责人）：`notes/files/public_users` 的后端 schema 与权限规则是否有正式文档可对齐？
- Q-003（测试负责人）：30 天删除保留策略是否需加自动化测试覆盖本地与云端一致性？
- Q-004（产品负责人）：是否继续保留“扩展系统”入口，还是在 PRD 中明确下线。

## 12. 证据索引

| 证据 ID | 文件路径 | 代码位置 | 证据摘要 |
| --- | --- | --- | --- |
| E1 | `src/router/index.ts` | line 9-60 | 核心路由：私有、公开、认证、回收站 |
| E2 | `src/router/index.ts` | line 77-81 | 桌面端访问 `/n/*` `/f/*` 重定向 `/home` |
| E3 | `src/router/index.ts` | line 85-99 | 公开用户路由首次进入触发公开数据初始化与同步 |
| E4 | `src/main.ts` | line 55-71 | 启动并行初始化，失败仍挂载应用 |
| E5 | `src/App.vue` | line 67-92 | 登录态变化后统一触发 Realtime + Sync |
| E6 | `src/types/index.ts` | line 14-32 | `Note` 数据契约 |
| E7 | `src/database/dexie.ts` | line 29-33 | Dexie 表结构定义 |
| E8 | `src/database/sync.ts` | line 35-43, 220-226 | `useRefDBSync` 自动同步与防抖 |
| E9 | `src/stores/notes.ts` | line 9-12, 189-239 | 笔记内存索引与 CRUD |
| E10 | `src/stores/notes.ts` | line 264-267 | 最近删除按 30 天过滤 |
| E11 | `src/stores/notes.ts` | line 382-411 | 父级文件夹 note_count 递归更新 |
| E12 | `src/views/HomePage.vue` | line 106-127 | 首页新增根文件夹 |
| E13 | `src/views/FolderPage.vue` | line 109-129 | 文件夹页新增子文件夹 |
| E14 | `src/views/NoteDetail.vue` | line 281-292, 411-412 | 编辑器 blur 触发 800ms 防抖保存 |
| E15 | `src/views/NoteDetail.vue` | line 177-249 | 新建/更新笔记主流程 |
| E16 | `src/views/NoteDetail.vue` | line 254-271 | 保存后触发静默同步并提示结果 |
| E17 | `src/views/NoteDetail.vue` | line 274-277 | 空内容时删除笔记 |
| E18 | `src/components/NoteMore.vue` | line 81-133, 160-193 | 分享、锁定、删除行为 |
| E19 | `src/components/LongPressMenu.vue` | line 57-104 | 重命名/删除/恢复/永久删除/移动菜单 |
| E20 | `src/components/NoteMove.vue` | line 46-85 | 移动笔记并更新旧/新父级计数 |
| E21 | `src/views/LoginPage.vue` + `src/views/RegisterPage.vue` | line 40-73, 42-58/63-103 | 登录与注册输入校验及提交 |
| E22 | `src/core/auth-manager.ts` | line 118-145 | 认证初始化：本地态 + authRefresh |
| E23 | `src/pocketbase/auth.ts` | line 12-20, 34-55, 103-120 | 登录/注册/刷新认证接口 |
| E24 | `src/hooks/useSync.ts` | line 242-253 | 未登录时静默同步直接返回 |
| E25 | `src/hooks/useSync.ts` | line 307-415 | 双向增量同步与冲突处理 |
| E26 | `src/hooks/useEditor.ts` + `src/hooks/useSync.ts` | line 137-157, 60-147, 425-458 | 附件 hash 本地化与上传回填 |
| E27 | `src/pocketbase/notes.ts` | line 116-119, 150-193, 204-208 | 用户级过滤查询、upsert 回退、公开笔记查询 |
| E28 | `src/adapters/pocketbase/realtime-adapter.ts` | line 51-57, 135-143 | 实时订阅按 user_id 过滤并按时间戳更新 |
| E29 | `src/components/UserProfile.vue` | line 126-155 | 手动同步与结果统计展示 |
| E30 | `src/stores/publicNotes.ts` | line 13-18, 46-70 | 每个公开用户独立本地数据库 |
| E31 | `src/hooks/useUserPublicNotesSync.ts` | line 20-27 | username -> userInfo -> publicNotes 同步 |
| E32 | `src/views/UserPublicNotesPage.vue` | line 61-76, 161-169 | 公开主页加载、桌面分栏 |
| E33 | `src/components/GlobalSearch/GlobalSearch.vue` | line 47-57 | 全局搜索 300ms 防抖 |
| E34 | `src/hooks/useWebAuthn.ts` | line 59, 184-189 | 生物识别验证 1 分钟有效期 |
| E35 | `src/hooks/useLastVisitedRoute.ts` | line 15-18, 38-42 | 保存并恢复上次访问路由 |
| E36 | `src/hooks/useDeviceType.ts` | line 7-9 | 640px 桌面阈值 |
| E37 | `src/components/NoteListItem.vue` | line 53-90 | 列表项根据上下文生成路由 |
| E38 | `src/pocketbase/client.ts` | line 7, 20-34 | PocketBase 地址与错误消息映射 |
| E39 | `src/hooks/useExtensions.ts` | line 18-19, 110-113 | 扩展系统无可用扩展且标注废弃 |

