import type { Content, JSONContent } from '@tiptap/core'
import { Color } from '@tiptap/extension-color'
import { ListItem, TaskList } from '@tiptap/extension-list'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyleKit } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { Editor } from '@tiptap/vue-3'
import GlobalDragHandle from 'tiptap-extension-global-drag-handle'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useNoteFiles } from '@/hooks/useNoteFiles'
import { filesApi } from '@/pocketbase'
import { FileUpload } from '@/shared/lib/editor/extensions/FileUpload/FileUpload'
import { TableWithWrapper } from '@/shared/lib/editor/extensions/TableWithWrapper'
import { TaskItem } from '@/shared/lib/editor/extensions/TaskItem'
import { TableCell, TableHeader, TableRow } from '@/shared/lib/editor/extensions/tiptap-table'
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

export function useNoteEditor() {
  const editor = ref<Editor | null>(null)
  const { addNoteFile, getNoteFileByHash } = useNoteFiles()

  function isHashValue(str: string): boolean {
    return /^[a-f0-9]{64}$/i.test(str)
  }

  async function loadFileFromStorage(hashOrFilename: string) {
    try {
      if (isHashValue(hashOrFilename)) {
        const localFile = await getNoteFileByHash(hashOrFilename)
        if (localFile && localFile.file) {
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
        const currentPath = window.location.pathname
        let noteId = ''

        if (/^\/[^/]+\/n\/[^/]+$/.test(currentPath)) {
          const pathParts = currentPath.split('/')
          noteId = pathParts[pathParts.length - 1]
        }
        else if (/^\/n\/[^/]+$/.test(currentPath)) {
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

  async function insertFiles(files: FileList): Promise<string[]> {
    if (!editor.value)
      return []

    const insertedHashes: string[] = []

    for (const file of Array.from(files)) {
      try {
        const hash = await getFileHash(file)
        const existingFile = await getNoteFileByHash(hash)
        if (!existingFile) {
          await addNoteFile(file, hash)
        }

        editor.value.commands.setFileUpload({ url: hash })
        insertedHashes.push(hash)
      }
      catch (error) {
        console.error('插入文件失败:', error, file.name)
      }
    }

    return insertedHashes
  }

  function extractFileHashes(): string[] {
    if (!editor.value) {
      return []
    }

    const html = editor.value.getHTML()
    const fileHashRegex = /<file-upload[^>]+url="([^"]+)"/g
    const fileHashes: string[] = []
    let match = fileHashRegex.exec(html)

    while (match !== null) {
      fileHashes.push(match[1])
      match = fileHashRegex.exec(html)
    }

    return fileHashes
  }

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

  function applyDefaultHeadingIfEmpty() {
    return applyDefaultHeadingIfEmptyToEditor(editor.value)
  }

  function isMeaningfulContent() {
    if (!editor.value) {
      return false
    }

    return hasMeaningfulEditorContent(editor.value.getJSON())
  }

  function setContent(content: Content) {
    editor.value?.commands.setContent(content)
  }

  function getContent(): string | undefined {
    return editor.value?.getHTML()
  }

  function setEditable(editable: boolean) {
    editor.value?.setEditable(editable)
  }

  function setInputMode(inputMode: 'text' | 'none') {
    editor.value?.setOptions({
      editorProps: {
        attributes: {
          inputmode: inputMode,
        },
      },
    })
  }

  function destroyEditor() {
    editor.value?.destroy()
    editor.value = null
  }

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
