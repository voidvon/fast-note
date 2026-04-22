# Fastnote

<div align="center">

![Fastnote Logo](./fastnote/public/icons/icon-128x128.png)

Fastnote 是一个前后端一体的笔记应用。

[在线 Demo](https://n.0122.vip)

</div>

## 项目简介

Fastnote 用于记录、整理和同步个人笔记内容，适合部署为自托管笔记服务。

核心功能：

- 笔记与文件夹管理
- 富文本编辑
- 账号登录与多端同步
- 公开笔记访问
- 基于 `pb_data/` 的本地持久化

## 使用说明

每个 release 包目录默认包含以下内容：

```text
fastnote_<version>_<target>/
├── fastnote 或 fastnote.exe
├── pb_data/
└── README.md
```

- `fastnote` / `fastnote.exe`：主程序，已内嵌前端静态资源。
- `pb_data/`：运行期数据目录，用于保存 PocketBase 数据、上传文件与运行状态。
- `README.md`：当前 release 包的最小运行说明。

推荐将整个 release 目录解压到目标服务器或运行目录，并始终在该目录内启动程序。

## 首次使用

Linux 或 macOS：

```bash
cd fastnote_v1.2.3_darwin_arm64
./fastnote serve
```

Windows：

```bash
cd fastnote_v1.2.3_windows_amd64
fastnote.exe serve
```

首次启动后，应用会继续在当前目录下使用 `./pb_data/` 保存数据。

## 部署建议

1. 将对应平台的 release `.zip` 上传到服务器。
2. 解压到固定目录，例如 `/www/wwwroot/fastnote/` 或 `/opt/fastnote/`。
3. 确保进程启动用户对该目录及其 `pb_data/` 具有读写权限。
4. 在 release 目录内执行 `./fastnote serve` 启动服务。
5. 通过 Nginx、Caddy 或其他反向代理将域名流量转发到 Fastnote 服务端口。

如果服务端需要长期运行，建议通过 systemd、supervisor 或宝塔 Go 项目托管进程。

## 升级方式

升级时应保留原有 `pb_data/`，只替换程序文件和文档：

1. 停止旧进程。
2. 备份当前目录，尤其是 `pb_data/`。
3. 解压新的 release 包。
4. 保留旧目录中的 `pb_data/`，替换新的二进制文件。
5. 在新版本目录中重新启动 `./fastnote serve`。

## 运维注意事项

- 不建议从 release 目录外直接调用二进制。
- 不建议随意删除或覆盖 `pb_data/`。
- 通过 systemd、supervisor、宝塔等进程管理器启动时，应将工作目录设置为 release 包所在目录。
- Release 包内已经包含前端页面资源，通常不需要单独部署前端静态站点。
- 应用数据默认依赖 `pb_data/` 持久化，生产环境应将其纳入备份策略。
- 如需覆盖内嵌前端资源，可设置 `FASTNOTE_WEB_DIST`，或在运行目录放置 `pb_public/`。

## 静态资源覆盖

后端启动后会按以下顺序查找前端静态资源：

1. `FASTNOTE_WEB_DIST`
2. 运行目录下的 `pb_public/`
3. 可执行文件附近的 `fastnote/dist`
4. 内嵌在后端二进制中的静态资源

示例：

```bash
FASTNOTE_WEB_DIST=../fastnote/dist ./fastnote serve
```

## 架构说明

Fastnote 采用前后端一体架构：

- 前端基于 Vue 3、Ionic 和 Tiptap，负责笔记编辑、列表管理与页面交互。
- 后端基于 PocketBase Go 宿主，负责账号、数据存储、文件能力与服务运行。
- 发布时前端静态资源会嵌入后端二进制，部署时通常只需要运行 release 包中的主程序。
- 运行期数据统一保存在 `pb_data/` 目录中。
