# 技术栈

## 核心框架

- **Vue 3** - 使用 Composition API 和 `<script setup>` 语法
- **TypeScript** - 严格类型检查，使用 `@/` 别名引用 src 目录
- **Ionic 8** - 跨平台 UI 组件库，提供移动端原生体验
- **Vue Router 4** - 单页应用路由管理

## 构建工具

- **Vite** - 快速开发服务器和构建工具
- **UnoCSS** - 原子化 CSS 引擎
- **ESLint** - 代码规范检查（使用 @antfu/eslint-config）

## 数据层

- **Dexie.js** - IndexedDB 包装器，用于本地数据存储
- **PocketBase** - 后端服务，当前通过 Go 宿主程序集成，提供认证、实时同步和文件存储
- **Axios** - HTTP 客户端

## 编辑器

- **Tiptap** - 基于 ProseMirror 的富文本编辑器
- 支持的扩展：Color、TextStyle、TextAlign、Image、Table、Underline 等
- 自定义扩展：FileUpload、Indent、TableWithWrapper

## 跨平台支持

- **Capacitor** - 移动端原生功能访问（App、Haptics、Keyboard、StatusBar）
- **Tauri** - 桌面端应用打包

## 常用命令

```bash
# 开发
cd fastnote && npm run dev      # 启动前端开发服务器（端口 8888）

# 构建
cd fastnote && npm run build    # TypeScript 类型检查 + Vite 构建
cd backend && go build ./...    # 构建 PocketBase Go 宿主

# 测试
cd fastnote && npm run test:unit  # 运行单元测试（Vitest）
cd fastnote && npm run test:e2e   # 运行 E2E 测试（Cypress）

# 代码质量
cd fastnote && npm run lint     # ESLint 检查

# 预览
cd fastnote && npm run preview  # 预览生产构建

# Tauri（桌面端）
cd fastnote && npm run tauri dev    # 开发桌面应用
cd fastnote && npm run tauri build  # 构建桌面应用

# 本地后端
cd backend && go run . serve        # 启动 PocketBase Go 宿主
```

## 开发服务器配置

- 前端端口：8888
- 后端端口：8090
- 主机：0.0.0.0（支持局域网访问）
- 代理配置：
  - `/e` 和 `/d` → `https://next.0122.vip`
  - `/api` → `http://127.0.0.1:8090`

## 环境变量

前端环境变量位于 `fastnote/.env`、`fastnote/.env.local` 和 `fastnote/.env.production`。
