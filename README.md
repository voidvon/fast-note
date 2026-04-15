# fastnote

<div align="center">

![fastnote Logo](./fastnote/public/icons/icon-128x128.png)

一个前后端一体的本地优先笔记应用。  
前端基于 Vue 3 + Ionic + Tiptap，后端基于 PocketBase Go 宿主，支持离线使用、云端同步、公开笔记与跨端部署。

[在线演示](https://n.0122.vip) · [问题反馈](https://github.com/coder-virjay/fast-note/issues)

</div>

## 项目简介

fastnote 采用单仓库结构：

- `fastnote/` 负责前端应用、编辑器、同步流程、桌面与移动端适配
- `backend/` 负责 PocketBase Go 宿主、静态资源挂载、hooks、migrations
- `docs/` 负责架构说明、开发文档和方案沉淀

项目当前的核心方向是：

- 本地优先：先写本地状态与 IndexedDB，再做云端同步
- 一体化交付：前端静态资源可嵌入后端二进制统一发布
- 跨端覆盖：兼容 Web，保留 Tauri 桌面端与 Capacitor 移动端能力

## 核心能力

- 笔记与文件夹管理
- 富文本编辑
- 离线存储与刷新恢复
- PocketBase 账号体系与云端同步
- PocketBase realtime 变化接收
- 公开笔记访问能力
- 桌面端与移动端响应式布局

## 技术栈

前端：

- Vue 3
- TypeScript
- Ionic 8
- Vue Router 4
- Vite
- UnoCSS
- Tiptap
- Dexie
- Vitest
- Cypress
- Tauri
- Capacitor

后端：

- Go 1.24+
- PocketBase

## 仓库结构

```text
.
├── backend/                 PocketBase Go 宿主、hooks、migrations、静态资源挂载
├── docs/                    架构说明、开发文档、方案文档
├── fastnote/                Vue 3 + Ionic 前端应用
│   ├── src/app/             应用启动、路由、全局装配
│   ├── src/processes/       会话初始化、同步编排、导航恢复
│   ├── src/pages/           路由页面装配
│   ├── src/widgets/         业务组合 UI
│   ├── src/features/        用户动作与业务用例
│   ├── src/entities/        业务实体、规则、状态
│   ├── src/shared/          基础设施、工具、类型、通用 UI
│   ├── tests/               单测、集成测试、E2E
│   └── src-tauri/           Tauri 桌面端工程
├── scripts/                 开发、构建、发布脚本
├── package.json             根目录统一脚本入口
└── README.md
```

## 快速开始

### 环境要求

- Node.js
- npm
- Go 1.24+

### 安装依赖

```bash
git clone https://github.com/voidvon/fast-note.git
cd fast-note

npm run install:frontend
npm run tidy:backend
```

### 启动开发环境

同时启动前端和 PocketBase Go 后端：

```bash
npm run dev
```

分别启动：

```bash
npm run dev:frontend
npm run dev:backend
```

前端默认通过以下顺序解析 PocketBase 地址：

1. `VITE_POCKETBASE_URL`
2. 浏览器当前 `origin`
3. `http://127.0.0.1:8090`

环境变量示例文件：

- `fastnote/.env.example`
- `backend/.env.example`

## 常用命令

```bash
# 前端依赖
npm run install:frontend

# Go 依赖整理
npm run tidy:backend

# 联调
npm run dev

# 只跑前端 / 后端
npm run dev:frontend
npm run dev:backend

# 构建
npm run build

# 校验
npm run lint
npm run test:unit
npm run test:e2e
```

## 构建与发布

构建前后端：

```bash
npm run build
```

生成发布包：

```bash
# 默认打全部支持目标
npm run release

# 只打当前机器对应目标
npm run release:local

# 指定版本号
npm run release -- --version=v1.2.3

# 只打指定目标
npm run release -- --target=darwin-arm64
npm run release -- --targets=darwin-arm64,linux-amd64,windows-arm64
```

当前支持目标：

- `darwin-amd64`
- `darwin-arm64`
- `linux-amd64`
- `linux-arm64`
- `linux-armv7`
- `linux-ppc64le`
- `linux-s390x`
- `windows-amd64`
- `windows-arm64`

发布结果默认输出到 `build/releases/`：

- `fastnote_<version>_<target>/`：单个平台的发布目录
- `fastnote_<version>_<target>.zip`：若本机存在 `zip` 命令，则同时生成压缩包
- `manifest.json`：记录本次打包的目标、目录与压缩包路径

发布目录中的前端资源已经嵌入到后端二进制，运行时仍使用外部 `pb_data/` 保存数据。

运行示例：

```bash
cd build/releases/fastnote_v1.2.3_darwin_arm64
./fastnote serve
```

Windows：

```bash
cd build/releases/fastnote_v1.2.3_windows_amd64
fastnote.exe serve
```

如需覆盖内嵌前端资源，可设置 `FASTNOTE_WEB_DIST`，或在运行目录放置 `pb_public/`。

## 测试

根目录统一入口：

```bash
npm run lint
npm run test:unit
npm run test:e2e
```

前端目录还提供了更细粒度脚本，例如：

- `npm --prefix fastnote run test:p0`
- `npm --prefix fastnote run test:p0:unit`
- `npm --prefix fastnote run test:p0:e2e`

## 开发说明

- 前端按 FSD 分层组织，`app -> processes -> pages/widgets/features -> entities -> shared`
- 前端保持 offline-first，本地状态是即时真相源
- PocketBase 相关正式 schema、规则、索引变更应进入 `backend/migrations`
- 后端当前以宿主能力为主，不在 `backend/` 堆放前端业务逻辑

更多信息可参考：

- `docs/架构说明.md`
- `docs/开发文档/`

## 贡献

欢迎提交 issue 和 PR。提交代码前建议至少执行：

```bash
npm run lint
npm run test:unit
```

## License

[MIT](./LICENSE)
