# 附件语义 HTML 契约

## 1. 决策

备忘录正文只保存一份 `notes.content`，格式为 Tiptap 可往返解析的语义 HTML。不额外保存编辑器 JSON，也不保存派生的公开页 HTML。

- 图片附件保存为标准 `<img>`。
- 非图片附件保存为标准 `<a>`。
- 编辑器继续使用 `fileUpload` NodeView 展示附件卡片，NodeView 不是持久化格式。
- 不兼容旧 `<file-upload>` 数据；测试阶段的数据按新契约重建。
- 继续复用 PocketBase `notes.files`，本阶段不新增附件 collection。

## 2. HTML 格式

图片附件：

```html
<img
  data-note-attachment="image"
  data-file-type="image/png"
  data-file-name="photo.png"
  data-file-size="1024"
  src="/api/files/notes/NOTE_ID/REMOTE_FILENAME"
  alt="photo.png"
  loading="lazy"
  decoding="async"
>
```

非图片附件：

```html
<a
  data-note-attachment="file"
  data-file-type="application/pdf"
  data-file-name="document.pdf"
  data-file-size="2048"
  href="/api/files/notes/NOTE_ID/REMOTE_FILENAME"
  download="document.pdf"
>document.pdf</a>
```

`data-note-attachment` 用于区分附件与正文中的普通图片、链接；`data-file-*` 用于恢复编辑器附件卡片所需的元数据。

## 3. 本地优先与同步

1. 粘贴或拖拽文件后，Blob 写入 IndexedDB，正文中的 `src` 或 `href` 暂时保存 SHA-256 hash；该本地笔记状态本身就是可恢复的上传任务，不需要额外 journal 表。
2. 同步时先预上传附件，只更新 PocketBase 的 `files` 字段；已有笔记保留旧文件，新笔记以非公开空正文暂存。远程正文不会写入 hash 或临时占位符。
3. PocketBase 返回实际文件名后，本地以一个 IndexedDB 事务将 hash 替换为同源 `/api/files/notes/{noteId}/{filename}` URL，同时写入 `notes.files` 和远程文件引用。
4. 最终 HTML 和目标 `notes.files` 一起提交到云端；最终提交失败时，本地更新时间保证晚于暂存记录，下一轮同步会继续提交最终内容。
5. 拉取远程笔记时只同步 HTML 和文件名引用；图片打开笔记后立即按需下载，其他附件由用户点击时下载，并写入本地附件缓存。

正文附件引用只从带 `data-note-attachment` 的 `<img>`、`<a>` 中提取。普通正文图片或链接不参与附件同步、缓存和 GC。

## 4. 删除与 GC

用户从正文删除附件节点后，下一次同步根据当前正文重新生成 `notes.files` 文件列表。PocketBase 文件字段中不再保留的文件由服务端删除。

IndexedDB 的附件 Blob 由本地引用集合保护；只有既不被任何笔记正文引用、也不被远程附件引用记录保护的 Blob 才进入本地 GC。远程文件名始终从语义附件 URL 的最后一个路径段提取。

## 5. 公开页

Go 公开页直接读取同一份 `notes.content`，使用 DOM 白名单清洗后写入服务端返回的 HTML 源码：

- 保留正文结构、标准 `<img>` 和 `<a>`。
- 移除脚本、事件属性、危险 URL 协议及不允许的嵌入内容。
- 使用首张安全图片生成 `og:image` 和 Twitter 图片元数据。
- 正文已有 `<h1>` 时不重复输出标题。

该过程只发生在公开页响应渲染时，不创建或保存第二份 HTML。
