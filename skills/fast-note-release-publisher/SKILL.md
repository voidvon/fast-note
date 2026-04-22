---
name: fast-note-release-publisher
description: 为 fastnote 仓库构建发布产物、确定或补建版本 tag、创建或修复 GitHub Release、上传多平台资产并完成最终验收。用于用户提出“发布一个版本 release”“补发 beta 版本”“重新上传 release 资产”“修复 tag 和 release 不一致”“帮我发预发布版本”这类需求时。
---

# 发布 fastnote Release

## 概述

按 fastnote 仓库当前的真实发布链路发版：先校验工作区和现有版本，再构建 `build/releases/` 产物，随后处理 git tag、GitHub prerelease 和资产上传，最后以远端 Release 状态作为交付依据。

不要假设仓库已经有完整自动化发布。当前仓库里的 `scripts/release.mjs` 只负责构建多平台产物，不会自动创建 tag 或 GitHub Release。

## 工作流

### 1. 建立发布上下文

先确认仓库当前状态，再决定是新发版、补发版，还是修复已有 release。

- 查看工作区状态：`git status --short --branch`
- 查看最近版本 tag：`git tag --sort=-version:refname | head -n 20`
- 查看 GitHub Release 列表：`gh release list --limit 20`
- 查看发布脚本与说明：
  - `package.json`
  - `scripts/release.mjs`
  - `README.md`

重点确认：

- 当前分支是否适合发版
- 工作区是否干净
- 最新 tag 和最新 GitHub Release 是否一致
- 目标版本是否已存在本地 tag、远端 tag、GitHub Release

### 2. 确定版本号

用户明确给出版本号时，直接使用，不要自行改写。

用户只说“发一个版本”而未指定版本号时，按现有版本序列推断，但先做事实核验：

- 同时查看本地 tag 与 GitHub Release
- 如果最新版本是 beta 预发布，例如 `v0.1.1-beta.3`，默认递增到 `v0.1.1-beta.4`
- 如果 tag 与 Release 不一致，以远端现状为准，写清具体缺口再继续

在汇报里始终写出明确版本号，不只说“最新”或“下一个版本”。

### 3. 做发布前检查

发版前至少执行以下检查：

- `gh auth status`
- `git remote -v`
- `npm run build`

处理规则：

- `npm run build` 失败：先修复或停止，不要继续发版
- 仅有非阻断 warning：允许继续，但在最终结果中说明
- `gh` 未登录或权限不足：先解决认证问题，再继续

### 4. 构建发布产物

统一使用根目录脚本：

- 全平台：`npm run release -- --version=<version>`
- 当前机器平台：`npm run release:local -- --version=<version>` 不适用当前仓库，`release:local` 已固定 `--current`
- 当前机器单平台时直接用：`npm run release -- --version=<version> --current`
- 部分目标：`npm run release -- --version=<version> --targets=<targets>`

默认完整发布走全平台，产物输出在 `build/releases/`。

构建完成后至少检查：

- `build/releases/manifest.json`
- 是否生成 9 个 zip
- zip 名称是否匹配 `fastnote_<version>_<target>.zip`

当前支持目标固定为：

- `darwin-amd64`
- `darwin-arm64`
- `linux-amd64`
- `linux-arm64`
- `linux-armv7`
- `linux-ppc64le`
- `linux-s390x`
- `windows-amd64`
- `windows-arm64`

### 5. 准备 Release Notes

在仓库临时目录生成 notes 文件，避免把长文本直接塞进命令行。

推荐路径：

- `.tmp/release-<version>-notes.md`

notes 内容要基于本次版本相对上一版本的真实提交，不要凭空总结。

建议先看：

- `git log --oneline <last-tag>..HEAD`
- `gh release view <last-tag>`

### 6. 处理 git tag

先分别检查三件事，不要把它们混为一谈：

- 本地 tag 是否存在：`git tag -l <version>`
- 远端 tag 是否存在：`git ls-remote --tags origin <version>`
- GitHub Release 是否存在：`gh release view <version>`

按以下规则处理：

- tag 不存在：创建 annotated tag，并 push 到远端
- tag 已存在但 Release 不存在：复用现有 tag 创建 Release
- Release 已存在但资产不完整：不要重建 tag，直接补传资产

创建 tag 时优先使用 annotated tag，例如：

- `git tag -a <version> -m "release: <version>"`
- `git push origin <version>`

注意：写 `.git` 元数据通常需要提升权限；若沙箱拦截，按规范申请 escalation。

### 7. 创建或修复 GitHub Release

优先创建 prerelease，除非用户明确要求正式版。

创建命令模式：

- `gh release create <version> --repo voidvon/fast-note --prerelease --title <version> --notes-file <notes-file>`

如果 `gh release view <version>` 返回 `release not found`，但远端 tag 已存在，这是正常的“只有 tag 没有 release”场景，直接重新执行 `gh release create` 即可。

如果 Release 创建后状态异常，先重新用 `gh release view <version> --json ...` 核实，不要假设 CLI 的上一条输出可靠。

### 8. 上传资产

对当前仓库，最稳定的顺序是：

1. 先上传 `manifest.json`
2. 再上传 zip
3. zip 分小批次上传，建议一次 3 个；如不稳定则退回单文件上传

命令模式：

- `gh release upload <version> manifest.json --repo voidvon/fast-note --clobber`
- `gh release upload <version> <zip-file> --repo voidvon/fast-note --clobber`

不要默认一次性上传全部 9 个 zip。这个仓库在当前环境里批量上传更容易出现长时间无回显或状态不一致。

如果上传过程中出现异常：

- 先用 `gh release view <version> --json assets` 查看远端真实资产列表
- 如果部分资产已上传，只补缺失资产，不重复重建 Release
- 如果怀疑有卡住的上传进程，先确认再清理，避免并发上传互相干扰

### 9. 最终验收

最终以 GitHub 远端状态为准，不以本地命令退出码为准。

至少执行：

- `gh release view <version> --json url,assets,isDraft,isPrerelease`
- `gh release list --limit 10`

验收标准：

- Release URL 正常
- `isDraft=false`
- `isPrerelease` 符合预期
- 资产总数为 10 个
- 资产包含：
  - `manifest.json`
  - 9 个平台 zip

如有需要，再补充：

- `git status --short`
- `git rev-parse HEAD`

### 10. 汇报结果

最终输出至少包含：

- 发布版本号
- Release URL
- 是否为 prerelease
- 已上传资产总数
- 关键验证命令及结果
- 如果过程中遇到异常，说明最终如何修复

## 处理原则

- 不要假设“最新版本”或“已有 release”，必须先查
- 不要把 tag、GitHub Release、Release 资产当成同一个状态
- 优先复用已有 tag 和已有 Release，避免重复创建
- 资产上传时优先稳定性，不追求一次性批量
- 最终以远端 `gh release view` 结果收口
