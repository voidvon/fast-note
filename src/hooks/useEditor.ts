import type { Content, JSONContent } from '@tiptap/core'
import { Color } from '@tiptap/extension-color'
import { ListItem, TaskList } from '@tiptap/extension-list'
import { TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyleKit } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { Editor } from '@tiptap/vue-3'
import GlobalDragHandle from 'tiptap-extension-global-drag-handle'
import { computed, onBeforeUnmount, ref } from 'vue'
import { FileUpload } from '@/components/extensions/FileUpload/FileUpload'
import { TableWithWrapper } from '@/components/extensions/TableWithWrapper'
import { TaskItem } from '@/components/extensions/TaskItem'
import { useNoteFiles } from '@/hooks/useNoteFiles'
import { filesApi } from '@/pocketbase'
import { getFileHash } from '@/utils'

export const DEFAULT_NEW_NOTE_HEADING_CONTENT: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
    },
  ],
}

const NON_TEXT_MEANINGFUL_NODE_TYPES = new Set([
  'fileUpload',
  'table',
  'taskList',
])

export function hasMeaningfulEditorContent(doc?: JSONContent | null): boolean {
  if (!doc) {
    return false
  }

  if (doc.type === 'text') {
    return (doc.text || '').trim().length > 0
  }

  if (doc.type && NON_TEXT_MEANINGFUL_NODE_TYPES.has(doc.type)) {
    return true
  }

  if (doc.content && Array.isArray(doc.content)) {
    return doc.content.some(node => hasMeaningfulEditorContent(node))
  }

  return false
}

export function isDefaultNewNoteHeadingDocument(doc?: JSONContent | null): boolean {
  if (!doc || doc.type !== 'doc' || !doc.content || doc.content.length !== 1) {
    return false
  }

  const [firstNode] = doc.content
  return firstNode?.type === 'heading'
    && firstNode.attrs?.level === 1
    && !hasMeaningfulEditorContent(firstNode)
}

export function applyDefaultHeadingIfEmptyToEditor(editorInstance?: Pick<Editor, 'getJSON' | 'commands'> | null): boolean {
  if (!editorInstance) {
    return false
  }

  const currentDoc = editorInstance.getJSON()
  if (hasMeaningfulEditorContent(currentDoc) || isDefaultNewNoteHeadingDocument(currentDoc)) {
    return false
  }

  editorInstance.commands.setContent(DEFAULT_NEW_NOTE_HEADING_CONTENT)
  return true
}

/**
 * 编辑器组合式函数
 * 分离编辑器逻辑，提高可复用性和可测试性
 */
export function useEditor() {
  const editor = ref<Editor | null>(null)
  const { addNoteFile, getNoteFileByHash } = useNoteFiles()

  /**
   * 检查字符串是否为SHA256 hash值（64位十六进制）
   */
  function isHashValue(str: string): boolean {
    return /^[a-f0-9]{64}$/i.test(str)
  }

  /**
   * 加载文件（hash值从本地IndexedDB获取，PocketBase文件名从PocketBase获取）
   */
  async function loadFileFromStorage(hashOrFilename: string) {
    try {
      // 判断是hash值还是PocketBase文件名
      if (isHashValue(hashOrFilename)) {
        // 处理hash值 - 只从本地IndexedDB获取
        const localFile = await getNoteFileByHash(hashOrFilename)
        if (localFile && localFile.file) {
          // 创建临时URL用于显示
          const blobUrl = URL.createObjectURL(localFile.file)
          return {
            url: blobUrl,
            type: localFile.file.type,
          }
        }

        console.warn(`本地文件未找到: ${hashOrFilename}`)
        return { url: hashOrFilename, type: '' }
      }
      else {
        // 处理PocketBase文件名
        // 获取当前笔记ID
        const currentPath = window.location.pathname
        let noteId = ''

        if (/^\/[^/]+\/n\/[^/]+$/.test(currentPath)) {
          // 访问其他用户的备忘录
          const pathParts = currentPath.split('/')
          noteId = pathParts[pathParts.length - 1]
        }
        else if (/^\/n\/[^/]+$/.test(currentPath)) {
          // 访问自己的备忘录
          const pathParts = currentPath.split('/')
          noteId = pathParts[pathParts.length - 1]
        }

        if (noteId) {
          const result = await filesApi.getFileByFilename(noteId, hashOrFilename)
          if (result) {
            return {
              url: result.url,
              type: result.type,
            }
          }
        }

        console.warn(`PocketBase文件未找到: ${hashOrFilename}`)
        return { url: hashOrFilename, type: '' }
      }
    }
    catch (error) {
      console.error('加载文件失败:', error)
      return {
        url: hashOrFilename,
        type: '',
      }
    }
  }

  /**
   * 初始化编辑器
   */
  function initEditor(options: {
    onFocus?: () => void
    onBlur?: () => void
  } = {}) {
    editor.value = new Editor({
      extensions: [
        Color.configure({ types: [TextStyleKit.name, ListItem.name] }),
        TextStyleKit,
        StarterKit,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        TaskList,
        TaskItem,
        // 使用自定义的TableWithWrapper替代TableKit
        TableWithWrapper,
        TableRow,
        TableHeader,
        TableCell,
        FileUpload.configure({
          loadFile: loadFileFromStorage,
          onImageLoaded(url: string, width: number, height: number) {
            console.warn('图片加载完成', url, width, height)
          },
        }),
        GlobalDragHandle.configure({
          dragHandleWidth: 20,
          scrollTreshold: 100,
          dragHandleSelector: '.custom-drag-handle',
          excludedTags: [],
          customNodes: [],
        }),
      ],
      content: '',
      onBlur: options.onBlur,
      onFocus: options.onFocus,
    })
  }

  /**
   * 插入文件到编辑器
   */
  async function insertFiles(files: FileList): Promise<string[]> {
    if (!editor.value)
      return []

    const insertedHashes: string[] = []

    for (const file of Array.from(files)) {
      try {
        // 计算文件hash
        const hash = await getFileHash(file)

        // 检查文件是否已存在，如果不存在则存储
        const existingFile = await getNoteFileByHash(hash)
        if (!existingFile) {
          await addNoteFile(file, hash)
        }

        // 在编辑器中插入文件，使用hash作为url
        editor.value.commands.setFileUpload({ url: hash })
        insertedHashes.push(hash)
      }
      catch (error) {
        console.error('插入文件失败:', error, file.name)
      }
    }

    return insertedHashes
  }

  /**
   * 从编辑器内容中提取文件hash
   */
  function extractFileHashes(): string[] {
    if (!editor.value) {
      return []
    }

    const html = editor.value.getHTML()
    // 提取 file-upload 元素的 url 属性（即hash值）
    const fileHashRegex = /<file-upload[^>]+url="([^"]+)"/g
    const fileHashes: string[] = []
    let match = fileHashRegex.exec(html)

    while (match !== null) {
      fileHashes.push(match[1])
      match = fileHashRegex.exec(html)
    }

    return fileHashes
  }

  /**
   * 获取编辑器内容标题和摘要
   */
  function getContentInfo() {
    if (!editor.value)
      return { title: '', summary: '' }

    function extractTextFromNode(node: any): string {
      if (!node)
        return ''

      if (node.type === 'text') {
        return node.text || ''
      }

      if (['heading', 'listItem', 'paragraph'].includes(node.type)) {
        let text = ''
        if (node.content && Array.isArray(node.content)) {
          node.content.forEach((child: any) => {
            if (child.type === 'text') {
              text += child.text || ''
            }
          })
        }
        return text
      }

      return `[${node.type}]`
    }

    const json = editor.value.getJSON()
    let title = ''

    if (json?.content && json.content.length > 0 && json.content[0]) {
      title = extractTextFromNode(json.content[0]).trim()
    }

    const summary = editor.value
      .getText()
      .replace(title, '')
      .replace(/\n+/g, ' ')
      .trim()
      .slice(0, 255)

    return { title, summary }
  }

  /**
   * 给新建空白笔记设置默认一级标题骨架。
   */
  function applyDefaultHeadingIfEmpty() {
    return applyDefaultHeadingIfEmptyToEditor(editor.value)
  }

  /**
   * 判断编辑器当前是否包含语义上有效的内容。
   */
  function isMeaningfulContent() {
    if (!editor.value) {
      return false
    }

    return hasMeaningfulEditorContent(editor.value.getJSON())
  }

  /**
   * 设置编辑器内容
   */
  function setContent(content: Content) {
    editor.value?.commands.setContent(content)
  }

  /**
   * 获取编辑器内容
   */
  function getContent(): string | undefined {
    return editor.value?.getHTML()
  }

  /**
   * 设置编辑器可编辑状态
   */
  function setEditable(editable: boolean) {
    editor.value?.setEditable(editable)
  }

  /**
   * 设置输入模式
   */
  function setInputMode(inputMode: 'text' | 'none') {
    editor.value?.setOptions({
      editorProps: {
        attributes: {
          inputmode: inputMode,
        },
      },
    })
  }

  /**
   * 销毁编辑器
   */
  function destroyEditor() {
    editor.value?.destroy()
    editor.value = null
  }

  // 组件卸载时自动销毁编辑器
  onBeforeUnmount(() => {
    destroyEditor()
  })

  return {
    editor: computed(() => editor.value),
    initEditor,
    insertFiles,
    extractFileHashes,
    getContentInfo,
    applyDefaultHeadingIfEmpty,
    isMeaningfulContent,
    setContent,
    getContent,
    setEditable,
    setInputMode,
    destroyEditor,
  }
}
