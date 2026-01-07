# 项目结构

## 架构设计

项目采用**三层架构**，将核心逻辑、具体实现和 UI 层分离：

```
核心层（Core）→ 适配器层（Adapters）→ 扩展层/UI 层
```

### 核心层（src/core/）

定义抽象接口和管理器，不依赖具体实现：

- `auth-types.ts` / `auth-manager.ts` - 认证服务接口和管理器（单例）
- `realtime-types.ts` / `realtime-manager.ts` - 实时连接服务接口和管理器（单例）
- `sync-*.ts` - 数据同步逻辑（队列、策略、冲突解决）
- `network-monitor.ts` - 网络状态监控
- `websocket-manager.ts` - WebSocket 连接管理

### 适配器层（src/adapters/）

实现核心接口，对接具体后端服务：

- `pocketbase/auth-adapter.ts` - 实现 IAuthService 接口
- `pocketbase/realtime-adapter.ts` - 实现 IRealtimeService 接口

**重要**：如需切换后端（如 Supabase），只需实现新的适配器，核心层和 UI 层无需修改。

### UI 层

- `src/views/` - 页面组件
- `src/components/` - 可复用组件
- `src/hooks/` - Composition API hooks（业务逻辑复用）

## 目录说明

```
src/
├── core/                    # 核心层 - 抽象接口和管理器
├── adapters/                # 适配器层 - 具体实现
├── pocketbase/              # PocketBase 客户端封装
│   ├── auth.ts             # 认证相关
│   ├── notes.ts            # 笔记 CRUD
│   ├── files.ts            # 文件上传
│   └── users.ts            # 用户管理
├── database/                # 本地数据库
│   ├── dexie.ts            # Dexie 实例和表定义
│   ├── sync.ts             # 同步逻辑
│   └── types.ts            # 数据类型
├── stores/                  # Pinia 状态管理
│   ├── notes.ts            # 笔记状态
│   └── publicNotes.ts      # 公开笔记状态
├── hooks/                   # Composition API hooks
│   ├── useAuth.ts          # 认证相关
│   ├── useSync.ts          # 同步相关
│   ├── useEditor.ts        # 编辑器相关
│   ├── useNoteFiles.ts     # 笔记文件管理
│   ├── useTheme.ts         # 主题切换
│   └── ...
├── components/              # 可复用组件
│   ├── YYEditor.vue        # 富文本编辑器
│   ├── NoteList.vue        # 笔记列表
│   ├── NoteListItem.vue    # 笔记列表项
│   ├── GlobalSearch/       # 全局搜索组件
│   └── extensions/         # 编辑器扩展
├── views/                   # 页面组件
│   ├── HomePage.vue        # 首页
│   ├── FolderPage.vue      # 文件夹页面
│   ├── NoteDetail.vue      # 笔记详情
│   ├── LoginPage.vue       # 登录页面
│   └── ...
├── router/                  # 路由配置
├── utils/                   # 工具函数
├── types/                   # TypeScript 类型定义
├── css/                     # 全局样式
└── theme/                   # 主题配置

docs/                        # 项目文档
├── 产品文档/                # 产品需求和规划
├── 开发文档/                # 技术文档
└── 主题/                    # 主题相关文档
```

## 关键约定

### 1. 依赖方向

- UI 层 → 核心层（通过管理器）
- 适配器层 → 核心层（实现接口）
- **禁止**：UI 层直接依赖适配器层

```typescript
// ❌ 错误：直接使用适配器
import { pocketbaseAuthAdapter } from '@/adapters/pocketbase'

// ✅ 正确：使用核心管理器
import { authManager } from '@/core/auth-manager'

await authManager.login(email, password)
await pocketbaseAuthAdapter.signIn(email, password)
```

### 2. 初始化流程

核心服务在 `App.vue` 中初始化，确保全局可用：

```typescript
// App.vue
onMounted(async () => {
  // 1. 注入认证适配器
  authManager.setAuthService(pocketbaseAuthAdapter)
  await authManager.initialize()

  // 2. 如果已登录，建立实时连接
  if (authManager.isAuthenticated()) {
    const realtimeAdapter = new PocketBaseRealtimeAdapter()
    realtimeManager.setRealtimeService(realtimeAdapter)
    await realtimeManager.connect()
  }
})
```

### 3. 组件规范

- 使用 `<script setup>` 语法
- 使用 Composition API
- 复杂逻辑抽取到 hooks 中
- 组件保持简洁，专注于 UI 渲染

### 4. 样式规范

- 优先使用 UnoCSS 原子类
- 组件特定样式使用 `<style scoped>`
- 全局样式放在 `src/css/` 目录
- 使用 CSS 变量（定义在 `src/theme/variables.css`）

### 5. 类型定义

- 业务类型放在 `src/types/`
- 核心接口放在 `src/core/*-types.ts`
- 使用 TypeScript 严格模式
