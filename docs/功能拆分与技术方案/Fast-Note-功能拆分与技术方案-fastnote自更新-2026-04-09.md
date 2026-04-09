# Fast-Note 自更新技术方案

## 1. 文档信息

- 模块名称：fastnote 自更新
- 输出日期：2026-04-09
- 输出文件：`docs/功能拆分与技术方案/Fast-Note-功能拆分与技术方案-fastnote自更新-2026-04-09.md`
- 对应总览：`Fast-Note-功能拆分与技术方案-总览-fastnote自更新-2026-04-09.md`
- 模块范围：
  - 已发布 `build/FastNote/` 目录中的 launcher 命令行扩展
  - 更新版本检查、下载、校验、备份、替换、回滚
  - 发布端 manifest 生成与版本元数据治理
- 不在范围：
  - 前端 GUI 更新提示
  - Tauri 桌面自动更新
  - PocketBase 单独热升级

## 2. 模块目标与现状

- 业务目标：
  - 让终端用户在安装目录内直接执行 `./fastnote update` 完成升级
  - 保留 `data/` 和 `logs/`，避免升级时破坏用户数据
  - 在网络失败、校验失败、替换失败时能明确回滚
- 当前状态（已支持/部分支持/未支持）：未支持
- 关键证据：
  - `E1` [apps/launcher/cmd/fastnote/main.go:11](/Users/yytest/Documents/projects/fast-note/apps/launcher/cmd/fastnote/main.go#L11)：入口只直接执行 `bootstrap.Run`，尚无子命令和参数解析。
  - `E2` [apps/launcher/internal/bootstrap/bootstrap.go:19](/Users/yytest/Documents/projects/fast-note/apps/launcher/internal/bootstrap/bootstrap.go#L19)：启动器只做迁移、服务启动和健康检查。
  - `E3` [scripts/package/release.mjs:7](/Users/yytest/Documents/projects/fast-note/scripts/package/release.mjs#L7)：发布流程不产出可供客户端消费的更新清单。
  - `E4` [docs/部署说明.md:45](/Users/yytest/Documents/projects/fast-note/docs/部署说明.md#L45)：部署文档仍要求人工替换版本。
- 已知缺口：
  - 没有统一应用版本源
  - 没有“最新版本 -> 平台安装包 -> 校验值”的 manifest
  - 没有安装目录级备份、原子切换和回滚
  - 没有 Windows 自替换 helper

## 3. 逐功能点方案

### 3.1 [FSU-01] 版本展示与更新检查

#### 3.1.1 目标与边界

- 用户场景：
  - 用户执行 `./fastnote version` 查看当前安装版本、构建时间、运行平台
  - 用户执行 `./fastnote check-update` 查看是否有新版本可升级
- 范围内：
  - CLI 参数解析
  - 本地版本元数据读取
  - 远端 manifest 拉取与 semver 比较
- 范围外：
  - 自动下载与替换
  - GUI 提示

#### 3.1.2 现状证据

- 代码事实：
  - `E1` [apps/launcher/cmd/fastnote/main.go:11](/Users/yytest/Documents/projects/fast-note/apps/launcher/cmd/fastnote/main.go#L11)：当前没有 `os.Args` 解析或命令路由。
  - `E5` [package.json:4](/Users/yytest/Documents/projects/fast-note/package.json#L4)：仓库根版本为 `0.1.0`。
  - `E6` [apps/web/package.json:4](/Users/yytest/Documents/projects/fast-note/apps/web/package.json#L4)：Web 子包版本为 `0.0.1`。
  - `E7` [apps/desktop/src-tauri/tauri.conf.json:4](/Users/yytest/Documents/projects/fast-note/apps/desktop/src-tauri/tauri.conf.json#L4)：Desktop 壳版本为 `0.1.1`。
- 现状结论：
  - 当前安装包没有稳定、单一的应用版本来源，`version` 命令无法准确回答“当前装的是哪个发布版本”。
- 推断与待确认：
  - 推断：应新增 `build/FastNote/version.json` 作为安装目录运行时版本事实源。
  - 待确认：应用版本是否完全独立于 `apps/desktop` 版本。

#### 3.1.3 技术方案

- 方案摘要：
  - 在发布阶段生成 `build/FastNote/version.json`，由 launcher 运行时直接读取。
  - 新增 `fastnote version`、`fastnote check-update` 两个只读命令。
  - 远端读取 `manifest.json`，比较 `currentVersion` 与 `latest.version`，输出可读结果。
- 架构落点（按层）：
  - UI（`views/components`）：无，改为 CLI stdout/stderr 输出。
  - 编排（`hooks`）：新增 `apps/launcher/internal/cli` 和 `apps/launcher/internal/update` 做命令分发与检查流程。
  - 领域（`stores`）：新增 `apps/launcher/internal/version` 定义本地版本元数据模型、semver 比较与通道规则。
  - 持久化（`database`）：安装目录 `version.json` 为本地只读元数据；缓存远端 manifest 到 `data/update-cache/manifest.json`。
  - 云端（`pocketbase`）：无关 PocketBase；新增 HTTP manifest 获取客户端。
  - 路由（`router`）：CLI 子命令路由：`run`、`version`、`check-update`、`update`。
- 数据契约变更：
  - 字段/类型：
    - 新增本地 `version.json`
    - 新增远端 `manifest.json`
  - 兼容与迁移：
    - 首次上线时，若本地缺少 `version.json`，launcher 回退到编译期 `ldflags` 注入版本并给出“旧包未携带运行时版本元数据”提示。
- 同步与冲突策略：
  - 不涉及 `Note`、Dexie 或 PocketBase 数据同步。
- 错误处理与回滚策略：
  - 网络失败：`check-update` 返回退出码非 0，但不影响 `fastnote run`
  - manifest 解析失败：提示“更新源无效”，不进入升级流程

#### 3.1.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T1 | 新增统一应用版本源文件，例如 `release/version.json` | `release/version.json`、`package.json`、`apps/web/package.json` | 无 | 现有版本号不一致，需要一次性校准 |
| T2 | 发布脚本写入安装目录 `version.json` | `scripts/package/release.mjs`、`scripts/package/assemble-release.mjs` | T1 | 旧流程兼容性 |
| T3 | launcher 增加 CLI 路由与 `version` 命令 | `apps/launcher/cmd/fastnote/main.go`、`apps/launcher/internal/cli/*` | T2 | CLI 行为变更需保持默认启动兼容 |
| T4 | 增加 `check-update` 与 manifest 拉取 | `apps/launcher/internal/update/*` | T2 | 远端协议冻结过早会影响后续演进 |

#### 3.1.5 验收标准

- AC1：执行 `./fastnote version` 能输出当前应用版本、平台和 PocketBase 版本。
- AC2：执行 `./fastnote check-update`，在最新版时提示“已是最新版本”，在有新版本时提示目标版本与下载来源。
- AC3：远端不可达时，命令失败但不影响原有 `./fastnote` 启动。

#### 3.1.6 测试与验证

- 单元测试：
  - 版本文件解析
  - semver 比较
  - manifest 解析与通道过滤
- 集成/冒烟：
  - 无 manifest
  - manifest 返回同版本/高版本/降版本
  - 默认执行 `./fastnote` 仍走启动流程
- 回归关注点：
  - 默认启动行为不变
  - `FASTNOTE_HTTP_ADDR` 等现有环境变量不受影响

#### 3.1.7 风险与未决问题

- 风险：
  - 版本号来源不统一会导致客户端展示和发布实际版本不一致。
- 未决问题：
  - 是否要支持 `--channel stable|beta`。

### 3.2 [FSU-02] 自更新执行、替换与回滚

#### 3.2.1 目标与边界

- 用户场景：
  - 用户执行 `./fastnote update`，程序自动下载当前平台的新版本包并替换安装目录中的 `fastnote` 与 `backend/`
- 范围内：
  - 下载、sha256 校验、解压、备份、原子切换、失败回滚
  - `data/`、`logs/` 保留
- 范围外：
  - 增量补丁更新
  - 热更新运行中的 PocketBase 进程

#### 3.2.2 现状证据

- 代码事实：
  - `E2` [apps/launcher/internal/config/config.go:25](/Users/yytest/Documents/projects/fast-note/apps/launcher/internal/config/config.go#L25)：安装根目录由 `os.Executable()` 推导，可用于原地更新。
  - `E3` [apps/launcher/internal/pocketbase/pocketbase.go:10](/Users/yytest/Documents/projects/fast-note/apps/launcher/internal/pocketbase/pocketbase.go#L10)：运行依赖完整的 `backend/` 布局。
  - `E4` [scripts/package/assemble-release.mjs:17](/Users/yytest/Documents/projects/fast-note/scripts/package/assemble-release.mjs#L17)：发布物由 `fastnote + backend + data + logs` 组成。
  - `E8` [docs/部署说明.md:48](/Users/yytest/Documents/projects/fast-note/docs/部署说明.md#L48)：升级时明确要求保留 `data/` 和 `logs/`。
- 现状结论：
  - 现有目录结构天然适合“替换 `fastnote` 与 `backend/`，保留 `data/` 与 `logs/`”的升级模型。
  - 但当前没有 staging 目录、备份目录、状态记录文件，无法做可靠回滚。
- 推断与待确认：
  - 推断：需要把运行时更新状态落到 `data/update-state.json`，避免中断后无法恢复。
  - 待确认：是否允许 `fastnote update` 在服务正在运行时触发，还是必须先停服执行。

#### 3.2.3 技术方案

- 方案摘要：
  - `fastnote update` 默认只在“当前 launcher 未持有 PocketBase 子进程”时执行。
  - 更新流程采用“三段式”：
    1. 下载到 `data/updates/staging/<version>/`
    2. 备份当前 `fastnote` 与 `backend/` 到 `data/updates/backups/<currentVersion>/`
    3. 校验新包结构后执行原子切换，失败则回滚备份
- 架构落点（按层）：
  - UI（`views/components`）：CLI 进度输出，例如 `Checking`, `Downloading`, `Verifying`, `Switching`, `Rollback`
  - 编排（`hooks`）：`apps/launcher/internal/update/service.go` 负责完整更新状态机
  - 领域（`stores`）：`apps/launcher/internal/update/model.go` 定义 `UpdatePlan`、`Artifact`、`InstallState`
  - 持久化（`database`）：
    - `data/updates/staging/<version>/`
    - `data/updates/backups/<version>/`
    - `data/update-state.json`
  - 云端（`pocketbase`）：无；更新源改为 release manifest + 版本归档下载
  - 路由（`router`）：CLI 命令 `update [--version X.Y.Z] [--channel stable] [--force]`
- 数据契约变更：
  - 字段/类型：
    - `update-state.json`
      - `status`: `idle | downloading | verifying | ready_to_switch | switching | rollback_needed`
      - `fromVersion`
      - `toVersion`
      - `stagingDir`
      - `backupDir`
      - `createdAt`
    - 安装包结构规范：
      - 根目录必须包含 `fastnote` 或 `fastnote.exe`
      - `backend/pocketbase`
      - `backend/pb_hooks`
      - `backend/pb_migrations`
      - `backend/pb_public`
      - `version.json`
  - 兼容与迁移：
    - 首版客户端兼容旧安装目录；若不存在 `data/updates/`，运行时自动创建
- 同步与冲突策略：
  - 不改业务同步逻辑
  - 若用户希望在运行中更新，必须先终止当前 `fastnote run` 进程，再执行 `update`
- 错误处理与回滚策略：
  - 下载失败：清理 staging，保留旧版本
  - 校验失败：不进入切换阶段
  - 切换失败：用备份恢复 `fastnote` 与 `backend/`
  - 程序崩溃：下次启动若检测到 `rollback_needed`，优先恢复再启动服务

#### 3.2.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T5 | 设计安装包结构校验器 | `apps/launcher/internal/update/layout.go` | T4 | 布局规则一旦发布需谨慎演进 |
| T6 | 实现下载、校验、解压 | `apps/launcher/internal/update/download.go` | T4 | 大文件与断点续传策略 |
| T7 | 实现备份、切换、回滚状态机 | `apps/launcher/internal/update/service.go` | T5,T6 | 中断恢复复杂 |
| T8 | 补齐 `update-state.json` 恢复逻辑 | `apps/launcher/internal/bootstrap/*`、`apps/launcher/internal/update/*` | T7 | 启动路径与更新路径耦合 |
| T9 | 增加 `fastnote update --version` 与 `--dry-run` | `apps/launcher/internal/cli/*` | T7 | CLI 参数复杂度上升 |

#### 3.2.5 验收标准

- AC1：用户执行 `./fastnote update` 可下载新版本并保留原有 `data/`、`logs/`。
- AC2：下载校验失败或布局不完整时，安装目录不发生破坏性变更。
- AC3：切换失败后可自动回滚到旧版本，并再次执行 `./fastnote` 正常启动。
- AC4：支持 `./fastnote update --version 0.1.2` 安装指定稳定版本。

#### 3.2.6 测试与验证

- 单元测试：
  - 更新状态机状态迁移
  - 布局校验
  - 回滚条件判断
- 集成/冒烟：
  - 模拟下载成功并切换
  - 模拟 sha256 错误
  - 模拟切换中断后重启恢复
  - 已存在 `data/` 真实数据的升级验证
- 回归关注点：
  - 升级后 PocketBase 仍能读取旧 `data/`
  - 升级不覆盖 `logs/`

#### 3.2.7 风险与未决问题

- 风险：
  - 非原子目录替换在部分文件系统上可能留下半更新状态。
  - 用户可能把安装目录放在只读位置，导致更新失败。
- 未决问题：
  - 是否支持 `update` 自动停止并重启服务，还是要求用户手工停服。

### 3.3 [FSU-03] 发布清单与更新源协议

#### 3.3.1 目标与边界

- 用户场景：
  - 客户端需要稳定获取“最新版本、各平台下载地址、sha256、发布时间、变更摘要”
- 范围内：
  - 发布端生成 manifest
  - 安装包命名规范
  - 清单版本化
- 范围外：
  - 完整发布平台建设
  - 商店分发

#### 3.3.2 现状证据

- 代码事实：
  - `E3` [scripts/package/release.mjs:7](/Users/yytest/Documents/projects/fast-note/scripts/package/release.mjs#L7)：当前发布只依次执行构建和组装。
  - `E9` [scripts/package/fetch-pocketbase.mjs:12](/Users/yytest/Documents/projects/fast-note/scripts/package/fetch-pocketbase.mjs#L12)：PocketBase 资源已使用 `version + assets[target] + sha256` 模式。
  - `E10` [pocketbase/version.json:2](/Users/yytest/Documents/projects/fast-note/pocketbase/version.json#L2)：现有仓库已存在可复用的版本清单设计经验。
- 现状结论：
  - 发布侧缺的不是“下载能力”，而是“把应用发布物也抽象成类似 PocketBase 的可校验资源描述”。
- 推断与待确认：
  - 推断：应用 manifest 可沿用与 `pocketbase/version.json` 相近的数据模型，降低理解和实现成本。
  - 待确认：manifest 是否直接作为 GitHub Release 附件，还是同步到固定 URL。

#### 3.3.3 技术方案

- 方案摘要：
  - 新增发布清单文件 `release/manifest.json`
  - `npm run release` 后产出平台安装压缩包与 sha256
  - 发布脚本把产物上传至 release 源，并在固定 URL 暴露最新 manifest
- 架构落点（按层）：
  - UI（`views/components`）：无
  - 编排（`hooks`）：新增 `scripts/package/build-update-artifacts.mjs` 和 `scripts/package/build-manifest.mjs`
  - 领域（`stores`）：`release/manifest.schema.json` 或同等 TS 类型定义
  - 持久化（`database`）：`build/releases/<version>/` 与 `manifest.json`
  - 云端（`pocketbase`）：无；发布源可选 GitHub Releases / CDN
  - 路由（`router`）：无
- 数据契约变更：
  - 字段/类型：
    ```json
    {
      "schemaVersion": 1,
      "channel": "stable",
      "latest": {
        "version": "0.1.2",
        "publishedAt": "2026-04-09T12:00:00Z",
        "notes": "https://example.com/releases/0.1.2",
        "minSupportedVersion": "0.1.0"
      },
      "artifacts": {
        "darwin-arm64": {
          "url": "https://example.com/FastNote-0.1.2-darwin-arm64.zip",
          "sha256": "..."
        },
        "darwin-x64": {
          "url": "https://example.com/FastNote-0.1.2-darwin-x64.zip",
          "sha256": "..."
        },
        "linux-x64": {
          "url": "https://example.com/FastNote-0.1.2-linux-x64.tar.gz",
          "sha256": "..."
        },
        "win32-x64": {
          "url": "https://example.com/FastNote-0.1.2-win32-x64.zip",
          "sha256": "..."
        }
      }
    }
    ```
  - 兼容与迁移：
    - 通过 `schemaVersion` 控制 manifest 演进
    - 客户端发现不支持的 schema 时仅提示手工升级
- 同步与冲突策略：
  - 不涉及业务同步
- 错误处理与回滚策略：
  - 发布端生成 manifest 前必须先验证每个平台归档存在且校验值可计算
  - 先上传产物，后切换 latest manifest，避免 manifest 指向未完成资源

#### 3.3.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T10 | 统一安装包命名规范 | `scripts/package/*` | T1 | 历史包兼容 |
| T11 | 生成平台压缩包和 sha256 | `scripts/package/build-update-artifacts.mjs` | T10 | 跨平台压缩格式差异 |
| T12 | 生成并校验 `manifest.json` | `scripts/package/build-manifest.mjs` | T11 | manifest 字段冻结成本 |
| T13 | 发布流程接入 manifest 输出 | `scripts/package/release.mjs` | T11,T12 | 发布失败回滚 |

#### 3.3.5 验收标准

- AC1：每次发布都能得到机器可读的最新 manifest。
- AC2：manifest 中每个平台归档都包含可验证的 sha256。
- AC3：客户端能根据当前平台精确选择对应安装包。

#### 3.3.6 测试与验证

- 单元测试：
  - manifest schema 校验
  - 平台键映射
- 集成/冒烟：
  - 生成一次完整 release 目录并用客户端成功消费
- 回归关注点：
  - 现有 `npm run release` 主流程仍可出包

#### 3.3.7 风险与未决问题

- 风险：
  - 若 latest manifest 先发布，客户端可能下载到不存在的归档。
- 未决问题：
  - 是否需要支持私有更新源认证。

### 3.4 [FSU-04] Windows 自替换与重启策略

#### 3.4.1 目标与边界

- 用户场景：
  - Windows 用户执行 `fastnote update` 后，当前 `fastnote.exe` 不能直接覆盖自身，仍需完成升级
- 范围内：
  - helper/updater 进程
  - 退出当前进程、执行替换、重启
- 范围外：
  - Windows 服务化部署

#### 3.4.2 现状证据

- 代码事实：
  - `E11` [apps/launcher/internal/config/config.go:36](/Users/yytest/Documents/projects/fast-note/apps/launcher/internal/config/config.go#L36)：当前已按 OS 处理 `pocketbase.exe` 命名，说明 launcher 已具备基础跨平台分支。
  - `E12` [scripts/package/assemble-release.mjs:10](/Users/yytest/Documents/projects/fast-note/scripts/package/assemble-release.mjs#L10)：发布物也已按 Windows 输出 `fastnote.exe`。
- 现状结论：
  - 现有跨平台差异处理只停留在文件名层面，没有“运行中自替换”能力。
- 推断与待确认：
  - 推断：Windows 平台需要单独 helper 二进制，例如 `fastnote-updater.exe`
  - 待确认：helper 是否与主程序同仓库构建，还是运行时临时生成脚本

#### 3.4.3 技术方案

- 方案摘要：
  - macOS/Linux：主进程退出后可直接重命名与替换
  - Windows：`fastnote.exe` 在进入切换阶段前生成或携带 `fastnote-updater.exe`，由 helper 独立完成：
    1. 等待主进程退出
    2. 备份旧目录
    3. 替换 `fastnote.exe` 与 `backend/`
    4. 写入结果文件
    5. 可选重启 `fastnote.exe run`
- 架构落点（按层）：
  - UI（`views/components`）：CLI 打印“已交给 updater 进程执行”
  - 编排（`hooks`）：`apps/launcher/internal/update/windows_helper.go`
  - 领域（`stores`）：复用 `InstallState`
  - 持久化（`database`）：`data/update-result.json`
  - 云端（`pocketbase`）：无
  - 路由（`router`）：`update --restart`
- 数据契约变更：
  - 字段/类型：
    - `update-result.json`
      - `status`
      - `fromVersion`
      - `toVersion`
      - `error`
  - 兼容与迁移：
    - 非 Windows 平台忽略 helper 机制
- 同步与冲突策略：
  - 不影响业务同步
- 错误处理与回滚策略：
  - helper 替换失败时恢复备份并写 `error`
  - 主 launcher 下次启动优先读取 `update-result.json`，输出上次更新结果

#### 3.4.4 实施任务拆分

| 任务ID | 任务描述 | 变更文件 | 依赖 | 风险 |
| ------ | -------- | -------- | ---- | ---- |
| T14 | 设计 Windows helper 协议 | `apps/launcher/internal/update/*` | T7 | 进程协调复杂 |
| T15 | 构建 helper 二进制并接入发布包 | `apps/launcher/cmd/fastnote-updater/*`、`scripts/package/*` | T14 | 发布物体积增加 |
| T16 | 实现替换后可选重启 | `apps/launcher/internal/update/windows_helper.go` | T15 | 重启失败体验 |

#### 3.4.5 验收标准

- AC1：Windows 平台执行 `fastnote update` 后可完成主程序替换。
- AC2：替换失败时旧版本仍可正常启动。
- AC3：`--restart` 打开时，更新完成后可重新拉起服务。

#### 3.4.6 测试与验证

- 单元测试：
  - helper 参数解析
  - 结果文件写入
- 集成/冒烟：
  - Windows 本机或 CI runner 上执行真实替换
- 回归关注点：
  - helper 不应被误用于普通启动路径

#### 3.4.7 风险与未决问题

- 风险：
  - 杀毒或系统权限可能拦截可执行文件自替换。
- 未决问题：
  - helper 是否需要代码签名。

## 4. 附录：模块证据索引

| 证据ID | 代码位置 | 摘要 |
| ------ | -------- | ---- |
| E1 | `apps/launcher/cmd/fastnote/main.go:11` | 入口仅执行 `bootstrap.Run`，没有 CLI 子命令 |
| E2 | `apps/launcher/internal/bootstrap/bootstrap.go:19` | 启动流程只面向 PocketBase 迁移和运行 |
| E3 | `scripts/package/release.mjs:7` | 发布流缺少 manifest 生成 |
| E4 | `docs/部署说明.md:45` | 当前升级仍依赖人工替换 |
| E5 | `package.json:4` | 根版本号 `0.1.0` |
| E6 | `apps/web/package.json:4` | Web 版本号 `0.0.1` |
| E7 | `apps/desktop/src-tauri/tauri.conf.json:4` | Desktop 版本号 `0.1.1` |
| E8 | `docs/部署说明.md:48` | 升级时应保留 `data/` 和 `logs/` |
| E9 | `scripts/package/fetch-pocketbase.mjs:12` | PocketBase 资源模型已具备版本与 sha256 设计 |
| E10 | `pocketbase/version.json:2` | 现有版本清单可作为应用 manifest 设计参考 |
| E11 | `apps/launcher/internal/config/config.go:36` | 当前已存在 Windows 可执行文件命名分支 |
| E12 | `scripts/package/assemble-release.mjs:10` | 发布物按平台生成 `fastnote` / `fastnote.exe` |
