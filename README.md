# fastnote 备忘录

<div align="center">

![fastnote Logo](./fastnote/public/icons/icon-128x128.png)

**一个简洁高效的本地优先备忘录应用，让您随时随地记录灵感。**

[演示](https://n.0122.vip) · [报告Bug](https://github.com/coder-virjay/fast-note/issues) · [请求功能](https://github.com/coder-virjay/fast-note/issues)

</div>

## ✨ 特性

- 📝 **快速记录** - 简洁的界面，一键开始记录您的想法
- 🔄 **实时同步** - 多设备数据自动同步，随时随地访问您的备忘录
- 🏷️ **标签组织** - 使用标签系统有效整理和分类您的备忘录
- 🔍 **全文搜索** - 快速查找您需要的任何内容
- 🌙 **暗黑模式** - 保护您的眼睛，提供舒适的夜间使用体验
- 📊 **数据可视化** - 直观展示您的备忘录统计和使用习惯

## 🛠️ 技术栈

- 🖥️ [Vue.js 3](https://vuejs.org/) - 渐进式JavaScript框架
- 📱 [Ionic Framework](https://ionicframework.com/) - 跨平台移动应用开发框架
- 📘 [TypeScript](https://www.typescriptlang.org/) - 类型安全的JavaScript超集
- ⚡ [Vite](https://vitejs.dev/) - 下一代前端构建工具
- 🧭 [Vue Router](https://router.vuejs.org/) - Vue.js官方路由
- 📝 [Tiptap](https://tiptap.dev/) - 基于ProseMirror的可扩展富文本编辑器
- 💾 [Dexie.js](https://dexie.org/) - IndexedDB的优雅包装器，实现本地数据存储
- 🎨 [UnoCSS](https://unocss.dev/) - 即时的原子化CSS引擎
- 🌐 [Axios](https://axios-http.com/) - 基于Promise的HTTP客户端

## 📁 仓库结构

- `fastnote/`：前端应用，Vue 3 + Ionic + Vite，按 FSD 组织
- `backend/`：PocketBase Go 宿主、静态资源挂载、hooks、migrations
- `docs/`：开发文档、架构规划与产品说明

## 🚀 开始使用

### 前提条件

- Node.js
- Go (v1.24+)
- npm

### 安装

```bash
# 克隆仓库
git clone https://github.com/voidvon/fast-note.git

# 进入项目目录
cd fast-note

# 安装前端依赖并整理后端依赖
npm run install:frontend
npm run tidy:backend
```

### 开发

```bash
# 同时启动前端和 PocketBase Go 后端
npm run dev
```

如需分别启动：

```bash
npm run dev:frontend
npm run dev:backend
```

### 构建

```bash
# 构建前后端
npm run build

# 生成一体化发布目录
npm run release
```

`npm run release` 会输出：

- `build/fastnote/fastnote`：主程序二进制
- 前端静态资源已嵌入主程序二进制
- `build/fastnote/pb_data/`：运行时数据目录

在发布目录中运行：

```bash
cd build/fastnote
./fastnote serve
```

Windows 下使用：

```bash
cd build/fastnote
fastnote.exe serve
```

环境变量示例：

- 前端参考 `fastnote/.env.example`
- 后端参考 `backend/.env.example`

如需覆盖内嵌前端资源，可通过 `FASTNOTE_WEB_DIST` 指向自定义静态目录，或在运行目录放置 `pb_public/`。

## 📖 使用指南

1. **创建备忘录** - 点击主页面的"+"按钮开始新备忘录
2. **编辑备忘录** - 使用丰富的编辑器功能编写您的内容
3. **组织备忘录** - 添加标签和分类整理您的备忘录
4. **搜索内容** - 使用搜索栏快速找到需要的备忘录

## 🤝 贡献

我们欢迎各种形式的贡献，无论是新功能、bug修复还是文档改进。

1. Fork 这个仓库
2. 创建您的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件

## 👏 致谢

- 感谢所有贡献者和支持者
- 特别感谢开源社区的支持和鼓励

---

<div align="center">

如果这个项目对您有帮助，请给它一个⭐️!

</div>
