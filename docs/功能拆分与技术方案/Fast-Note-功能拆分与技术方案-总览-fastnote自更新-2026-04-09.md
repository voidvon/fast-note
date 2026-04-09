# Fast-Note 自更新功能拆分与技术方案总览

## 1. 文档信息

- 版本/迭代：Fast-Note 自更新能力预研 v0.1
- 输出日期：2026-04-09
- 输出文件：`docs/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-总览-fastnote自更新-2026-04-09.md`
- 输入来源：
  - `docs/需求文档/Fast-Note-PRD-代码反推-2026-03-04.md`
  - 当前仓库代码（分支/commit）：`refactor/workspace-pocketbase-launcher` / `c259f5b`
- 输出范围：
  - 面向已发布 `build/FastNote/` 安装目录的命令行自更新能力
  - `fastnote version`、`fastnote check-update`、`fastnote update`
  - 发布端版本清单、下载校验、解压替换、回滚与跨平台约束
- 不在范围：
  - `apps/desktop` 的 Tauri 内建更新机制
  - 前端页面内的更新弹窗与 GUI 交互
  - PocketBase 独立升级策略设计

## 2. 功能拆分总览

| 能力域 | 功能点 | 用户问题/价值 | 优先级 | 当前状态（已支持/部分支持/未支持） | 关键证据 |
| ------ | ------ | ------------- | ------ | ---------------------------------- | -------- |
| CLI 启动器 | FSU-01 版本展示与更新检查 | 用户希望知道当前安装版本，并确认是否存在新版本 | P0 | 未支持 | `apps/launcher/cmd/fastnote/main.go:11`, `package.json:4` |
| CLI 启动器 | FSU-02 自更新执行与回滚 | 用户希望通过 `fastnote update` 直接升级而不手工替换目录 | P0 | 未支持 | `apps/launcher/internal/config/config.go:25`, `docs/部署说明.md:45` |
| 发布链路 | FSU-03 发布清单与可校验下载 | 客户端更新前需要一个可信的“最新版本 + 平台资源 + 校验值”来源 | P0 | 未支持 | `scripts/package/release.mjs:7`, `scripts/package/fetch-pocketbase.mjs:9` |
| 版本治理 | FSU-04 应用版本统一治理 | 当前仓库内版本号分散，无法稳定映射到发布产物版本 | P1 | 部分支持 | `package.json:4`, `apps/web/package.json:4`, `apps/desktop/src-tauri/tauri.conf.json:4` |

## 3. 模块文档索引

| 模块 | 文档文件 | 功能点数量 | 负责人建议 | 备注 |
| ---- | -------- | ---------- | ---------- | ---- |
| fastnote 自更新 | [Fast-Note-功能拆分与技术方案-fastnote自更新-2026-04-09.md](./Fast-Note-功能拆分与技术方案-fastnote自更新-2026-04-09.md) | 4 | 后端/发布工程 | 单模块交付，覆盖 launcher 与发布链路 |

## 4. 里程碑与发布建议

- 里程碑划分：
  - M1：补齐只读命令，支持 `version` 与 `check-update`
  - M2：补齐发布清单生成与客户端下载校验
  - M3：补齐 `update` 原子替换、备份与回滚
  - M4：补齐 Windows helper 进程与失败恢复
- 上线策略：
  - 先灰度内部构建包，验证 macOS/Linux 全链路
  - Windows 平台单独以 beta 标记发布，待 helper 方案稳定后转正式
- 灰度/回滚：
  - 客户端保留最近一个 `backup/versions/<version>` 备份
  - 发布端保留最近两个 manifest，允许客户端按指定版本回退

## 5. 跨模块依赖与风险

- 依赖关系：
  - CLI 更新命令依赖统一的应用版本元数据
  - CLI 下载与替换依赖发布清单生成脚本
  - Windows 自替换依赖单独 helper/updater 二进制
- 关键风险：
  - 运行中的 `fastnote` 无法安全覆盖自身，尤其在 Windows 下
  - 更新中断若缺少原子切换，会破坏 `build/FastNote/` 可启动性
  - 现有发布物只有“目录结构约定”，没有“机器可读版本清单”
- 需要业务决策的问题：
  - 更新源托管在 GitHub Releases 还是自建 CDN/对象存储
  - 是否允许跳版本升级，还是仅支持从最近若干小版本升级
  - 是否保留 `fastnote update --channel beta` 能力

## 6. 附录：证据索引

| 证据ID | 代码位置 | 摘要 |
| ------ | -------- | ---- |
| E1 | `apps/launcher/cmd/fastnote/main.go:11` | launcher 当前没有命令分发，入口只会直接执行 `bootstrap.Run` |
| E2 | `apps/launcher/internal/bootstrap/bootstrap.go:19` | 启动流程只关注目录校验、迁移、服务启动和健康检查 |
| E3 | `apps/launcher/internal/config/config.go:25` | 运行目录由当前可执行文件所在目录推导，适合围绕安装目录做更新编排 |
| E4 | `apps/launcher/internal/pocketbase/pocketbase.go:10` | 运行前强依赖 `backend/`、`pb_public/`、`pb_hooks/`、`pb_migrations/` 完整存在 |
| E5 | `scripts/package/release.mjs:7` | 当前发布流程仅做构建与组装，没有生成版本 manifest |
| E6 | `scripts/package/assemble-release.mjs:17` | 发布目录会整体重建，并明确保留 `data/` 与 `logs/` |
| E7 | `scripts/package/fetch-pocketbase.mjs:9` | PocketBase 下载链路已有“版本 + 平台资源 + sha256”模型，可复用到应用更新 |
| E8 | `docs/部署说明.md:45` | 运行说明要求用户手工执行 `./fastnote`，升级说明仍是人工替换 |
| E9 | `package.json:4` | 仓库根版本号为 `0.1.0` |
| E10 | `apps/web/package.json:4` | Web 子包版本号与根版本号不一致，当前为 `0.0.1` |
| E11 | `apps/desktop/src-tauri/tauri.conf.json:4` | Desktop 壳版本号再次独立，当前为 `0.1.1` |
