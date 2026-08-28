<div align="center">

<img src="fastnote/public/icons/icon-128x128.png" alt="Fastnote" width="112">

# Fastnote

[![Vue](https://img.shields.io/badge/Vue.js-3-42b883.svg?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Framework7](https://img.shields.io/badge/Framework7-9-EE350F.svg?logo=framework7&logoColor=white)](https://framework7.io/)
[![Go](https://img.shields.io/badge/Go-1.24%2B-00ADD8.svg?logo=go&logoColor=white)](https://go.dev/)
[![版本](https://img.shields.io/badge/版本-v0.1.16-orange.svg)](https://github.com/voidvon/fast-note/releases/tag/v0.1.16)

**面向富文本写作、信息整理、跨设备同步和公开分享的离线优先自托管备忘录应用。**

[English](README.md) | 简体中文

<p>
  <a href="https://n.0122.vip">在线 Demo</a> ·
  <a href="https://github.com/voidvon/fast-note/releases">下载安装包</a> ·
  <a href="docs/开发文档/README.md">开发文档</a>
</p>

</div>

## 应用简介

Fastnote 是一个前后端一体的备忘录应用，目标是在网络不可用时也保持流畅的
记录和编辑体验。备忘录和文件夹会先写入本地存储，再在用户登录且网络可用时
与 PocketBase 后端同步。

项目既可以作为在线 Web 应用使用，也可以部署为自托管服务，或在本地以单一
代码仓库的形式开发 Vue 前端和 Go 后端。

> Fastnote 当前仍在持续开发中。升级或进行其他运维操作前，请先备份
> `pb_data/` 目录。

## 主要功能

- **离线优先编辑**：创建和编辑备忘录时优先更新本地状态，界面立即反馈；网络
  恢复后自动同步变更。
- **富文本备忘录**：基于 Tiptap，支持格式化文本、标题、列表、任务列表、表格、
  链接、图片和附件。
- **文件夹与导航**：使用多级文件夹组织备忘录，支持移动备忘录、大列表浏览，以及
  导航状态和滚动位置恢复。
- **账号与同步**：通过 PocketBase 注册和登录，在多设备间同步备忘录，接收实时
  变化并查看同步状态。
- **公开备忘录**：将选定的备忘录和文件夹发布到公开用户页面，同时保持私有工作区
  内容仅对登录用户可见。
- **AI 助手**：通过对话搜索备忘录和文件夹，并在确认后执行受支持的操作；需要
  自行配置兼容的 AI 服务商。
- **备忘录保护**：提供备忘录锁定和受保护的解锁流程，用于处理敏感内容。
- **附件管理**：在本地保存和整理备忘录附件，同时同步附件的远程引用状态。
- **响应式工作区**：桌面端使用分栏布局，移动端使用列表与详情切换，同一套
  应用覆盖不同屏幕尺寸。

## 下载安装

当前发布版本为 **v0.1.16**，这是用于测试的预发布版本。请从
[GitHub Releases](https://github.com/voidvon/fast-note/releases/tag/v0.1.16)
下载对应平台的安装包。

这些压缩包是用于自托管的服务端发布包。每个包都包含平台可执行文件、空的
`pb_data/` 目录和一份最小运行说明。前端资源已经嵌入可执行文件，通常不需要
额外部署独立的前端静态站点。

| 平台 | 架构目标 | 安装包 |
|---|---|---|
| macOS | `darwin-amd64`、`darwin-arm64` | ZIP 压缩包 |
| Linux | `linux-amd64`、`linux-arm64`、`linux-armv7`、`linux-ppc64le`、`linux-s390x` | ZIP 压缩包 |
| Windows | `windows-amd64`、`windows-arm64` | ZIP 压缩包 |

## 快速开始

### 使用在线 Demo

使用现代浏览器打开[在线 Demo](https://n.0122.vip)。如果要保存私密内容或用于
生产环境，请部署自己的 Fastnote 实例。

### 运行发布包

下载并解压适合当前操作系统的安装包，然后始终在解压目录内启动程序，以确保
`pb_data/` 与程序位于同一目录：

```bash
cd fastnote_v0.1.16_linux_amd64
./fastnote serve --http=127.0.0.1:8090
```

Windows PowerShell：

```powershell
cd fastnote_v0.1.16_windows_amd64
.\fastnote.exe serve --http=127.0.0.1:8090
```

打开 `http://127.0.0.1:8090` 并注册账号。服务会在当前目录的 `./pb_data/`
中保存数据库、上传文件和其他运行期持久化状态。

### 配置反向代理部署

如果需要长期运行，建议按以下方式部署：

1. 将对应版本的压缩包解压到独立目录，例如 `/opt/fastnote/`。
2. 确保服务进程用户对整个目录，尤其是 `/opt/fastnote/pb_data/` 具有读写权限。
3. 使用 systemd、supervisor 或其他进程管理器启动
   `./fastnote serve --http=127.0.0.1:8090`。
4. 使用 Nginx、Caddy 或其他反向代理，将 HTTPS 域名转发到本地 Fastnote 服务。
5. 将 `pb_data/` 纳入日常备份策略。

### 升级现有安装

内置更新命令会下载当前平台最新的**正式版** GitHub Release，并在替换程序文件
前创建 `pb_data` 备份：

```bash
./fastnote update
```

升级前请先停止服务，保留原有的 `pb_data/` 目录，完成后通过原进程管理器重新
启动。也可以手动升级：解压新版本安装包，只替换旧版本的可执行文件和包内说明
文档，不要覆盖原有的 `pb_data/`。

## 本地开发

### 环境要求

- Node.js 和 npm
- Go 1.24 或更高版本
- 现代浏览器

在仓库根目录安装前端依赖并整理后端 Go 模块：

```bash
npm run install:frontend
npm run tidy:backend
```

同时启动前端和本地 PocketBase Go 宿主：

```bash
npm run dev
```

前端地址为 `http://127.0.0.1:8888`，本地后端地址为
`http://127.0.0.1:8090`。开发后端使用独立的 `backend/pb_data`，其中的账号和
数据不会自动同步到线上或其他 PocketBase 实例。

如需单独启动一侧：

```bash
npm run dev:frontend
npm run dev:backend
```

### 构建与测试

```bash
npm run build
npm run lint
npm run test:unit -- --run
npm run test:e2e
```

生成完整的跨平台发布包：

```bash
npm run release -- --version=v0.1.16
```

发布脚本会构建前端，将静态资源嵌入 Go 宿主，并在 `build/releases/` 下为所有
支持的目标生成安装包。使用 `npm run release:local` 可以只构建当前机器平台。

## 配置与数据

- `fastnote/.env.example` 提供前端开发环境的默认配置。
- `backend/.env.example` 说明可选的 `FASTNOTE_WEB_DIST` 静态资源覆盖配置。
- 运行期数据统一位于 `pb_data/`，不要随意提交、删除或覆盖该目录。
- 静态资源依次从 `FASTNOTE_WEB_DIST`、`./pb_public`、相邻前端构建目录，以及
  可执行文件内嵌资源中查找。
- AI 功能需要配置服务商。向外部 AI 服务发送私密备忘录内容前，请先了解对应
  服务商的数据处理政策。

## 项目架构

Fastnote 采用前后端一体的 monorepo 结构：

```text
backend/
  main.go                         # PocketBase Go 宿主入口
  internal/server/                 # bootstrap、路由和 hooks
  migrations/                     # PocketBase 迁移入口

fastnote/
  src/app/                         # 应用启动与路由
  src/processes/                   # 同步、会话、导航、公开备忘录
  src/pages/                       # 路由页面装配
  src/widgets/                     # 较大的业务 UI 模块
  src/features/                    # 用户动作和业务用例
  src/entities/                    # 领域状态和业务规则
  src/shared/                      # 存储、API、UI 和通用工具
```

前端使用 Vue 3、TypeScript、Framework7、Vite、UnoCSS、Dexie、Tiptap 和
PocketBase JavaScript SDK；后端使用 Go 和 PocketBase 作为运行时宿主。本地
IndexedDB 状态是即时真相源，云端同步负责登录设备之间的最终一致性。

## 文档

| 文档 | 说明 |
|---|---|
| [开发文档](docs/开发文档/README.md) | 架构、环境搭建、实现细节和测试 |
| [产品文档](docs/产品文档/README.md) | 产品范围、功能、用户流程和规划 |
| [AI 对话 Agent 文档](docs/AI对话Agent/README.md) | AI 助手的需求、架构和当前实现 |
| [GitHub Releases](https://github.com/voidvon/fast-note/releases) | 已发布版本和各平台安装包 |

欢迎提交 Issue 和 Pull Request。反馈问题时，请附上受影响的平台、复现步骤、
版本号和相关日志。
