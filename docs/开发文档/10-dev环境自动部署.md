# Dev 环境自动部署

本文档说明当前仓库的 `dev` 自动部署工作流配置方式。对应工作流文件：

- [p0-sync-integrity.yml](/Users/yytest/Documents/projects/fast-note/.github/workflows/p0-sync-integrity.yml)

## 1. 当前策略

当前策略为：

1. GitHub Actions 在 `push main/master` 或手动触发时执行。
2. 先运行前端 P0 同步链路测试与前端构建。
3. 再构建 `linux-amd64` 发布目录。
4. 将发布目录打成 `tar.gz` 后通过 SSH 上传到服务器。
5. 服务器解压到新版本目录，并同步到宝塔 Go 项目的实际目录。
6. 复用共享 `pb_data/`。
7. 切换 `current` 软链，并通过宝塔 Go 项目的启动脚本重启进程。

该流程适用于 `dev.0122.vip` 这类开发环境，不依赖 GitHub Release。

## 2. GitHub Variables

在仓库或 `dev` Environment 中配置以下 Variables：

- `DEV_DEPLOY_HOST`
  - 服务器地址，例如 `dev.0122.vip`
- `DEV_DEPLOY_PORT`
  - SSH 端口，默认可填 `22`
- `DEV_DEPLOY_USER`
  - SSH 用户
- `DEV_DEPLOY_BASE_DIR`
  - 版本缓存根目录，例如 `/www/wwwroot/.fastnote-deploy`
- `DEV_DEPLOY_PROJECT_NAME`
  - 宝塔 Go 项目名，例如 `fastnote`

## 3. GitHub Secrets

配置以下 Secrets：

- `DEV_DEPLOY_SSH_KEY`
  - 用于部署的私钥内容
- `DEV_DEPLOY_KNOWN_HOSTS`
  - 可选。服务器 `known_hosts` 内容；若不配置，workflow 会使用 `ssh-keyscan`

建议把这些配置放到 GitHub Environment `dev` 中，而不是直接挂在仓库级别。

## 4. 服务器目录约定

服务器默认按以下结构组织：

```text
${DEV_DEPLOY_BASE_DIR}/
  current -> releases/fastnote_dev-<sha>_linux_amd64
  releases/
    fastnote_dev-<sha>_linux_amd64/
  shared/
    pb_data/
```

说明：

- 每次部署会生成新的 `releases/<package>` 目录
- `pb_data/` 放在 `shared/` 下长期复用
- `current` 软链始终指向当前版本
- 宝塔实际运行目录默认是 `/www/wwwroot/${DEV_DEPLOY_PROJECT_NAME}`

## 5. 宝塔 Go 项目要求

当前服务器实际形态：

```text
项目目录: /www/wwwroot/fastnote
启动脚本: /www/server/go_project/vhost/scripts/fastnote.sh
PID 文件: /var/tmp/gopids/fastnote.pid
运行用户: www
```

注意：

- `DEV_DEPLOY_BASE_DIR` 必须和项目目录分离
- 不要把 `DEV_DEPLOY_BASE_DIR` 配成 `/www/wwwroot/fastnote`

workflow 默认会按下面方式处理：

- 停止旧进程：
  - 优先读取 `/var/tmp/gopids/${DEV_DEPLOY_PROJECT_NAME}.pid`
  - 再兜底 `pkill -f "/www/wwwroot/${DEV_DEPLOY_PROJECT_NAME}/fastnote serve --http=0.0.0.0:8888"`
- 启动新进程：
  - 执行 `/www/server/go_project/vhost/scripts/${DEV_DEPLOY_PROJECT_NAME}.sh`
  - 以 `www` 用户启动
- 健康校验：
  - 检查 PID 文件是否生成且进程存在

要求：

- SSH 用户需要有权写入：
  - `${DEV_DEPLOY_BASE_DIR}`
  - `/www/wwwroot/${DEV_DEPLOY_PROJECT_NAME}`
- SSH 用户需要有权停止旧进程并以 `www` 用户执行启动脚本
- 当前 workflow 以 `root` 用户部署最简单

## 6. 注意事项

- 当前 workflow 只自动部署 `linux-amd64`
- 当前 workflow 默认复用服务端 `pb_data/`，不会覆盖数据目录
- 如果服务器前面有 Nginx/Caddy，请保持 `dev.0122.vip` 反向代理到宝塔 Go 项目监听端口
- 若后续需要 beta/prod 发布，建议另建 workflow，走 GitHub Release 或制品归档流程，不与 dev 混用
