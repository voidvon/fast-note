# Fast-Note

Fast-Note 现已按“前端源码 + 启动器源码 + PocketBase 官方二进制运行时资源”重组为单仓库。

## Repository Layout

- `apps/web`: Vue 前端源码与测试
- `apps/launcher`: Go 启动器，负责拉起官方 PocketBase 二进制
- `apps/desktop`: Tauri 桌面端壳子，独立于服务器发布链路
- `pocketbase/pb_hooks`: PocketBase JavaScript hooks
- `pocketbase/pb_migrations`: PocketBase JavaScript migrations
- `scripts/package`: 发布构建脚本

## Docs

- `docs/`: 项目唯一文档目录，包含架构、开发说明、产品文档、专题文档、需求文档、技术方案、开发计划和归档资料
- `docs/README.md`: 文档总导航

## Development

```bash
npm install
npm run dev
```

默认开发命令会启动 `apps/web`。

## Release Build

```bash
npm run release
```

发布脚本会执行以下步骤：

1. 构建 `apps/web`
2. 构建 `apps/launcher`
3. 下载固定版本的 PocketBase 官方二进制
4. 组装 `build/FastNote`

最终发布目录：

```text
build/FastNote/
  fastnote
  backend/
    pocketbase
    pb_hooks/
    pb_migrations/
    pb_public/
  data/
  logs/
  README.md
```

## License

MIT
