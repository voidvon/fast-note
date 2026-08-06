import type { Content, JSONContent } from '@tiptap/core'
import type { EditorProps } from '@tiptap/pm/view'
import { Color } from '@tiptap/extension-color'
import { ListItem, TaskList } from '@tiptap/extension-list'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyleKit } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { Editor } from '@tiptap/vue-3'
import GlobalDragHandle from 'tiptap-extension-global-drag-handle'
import { computed, onBeforeUnmount, ref } from 'vue'
import { extractAttachmentReferences } from '@/entities/attachment'
import {
  hydrateRemoteAttachment,
  registerActiveAttachmentHash,
  resolveStoredRemoteAttachment,
  unregisterActiveAttachmentHashes,
} from '@/entities/attachment/model/attachment-lifecycle-service'
import { noteRemoteService, useNoteFiles } from '@/entities/note'
import { handleAttachmentDrop, handleAttachmentPaste } from '@/features/note-editor/lib/attachment-transfer'
import { handleEditableLinkClick } from '@/features/note-editor/lib/link-click'
import { getRemoteAttachmentFilename } from '@/shared/lib/editor/extensions/FileUpload/attachment-html'
import { AttachmentAwareLink } from '@/shared/lib/editor/extensions/FileUpload/AttachmentAwareLink'
import { FileUpload } from '@/shared/lib/editor/extensions/FileUpload/FileUpload'
import { TableWithWrapper } from '@/shared/lib/editor/extensions/TableWithWrapper'
import { TaskItem } from '@/shared/lib/editor/extensions/TaskItem'
import { TableCell, TableHeader, TableRow } from '@/shared/lib/editor/extensions/tiptap-table'
import { getFileHash } from '@/shared/lib/file-hash'

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

export function resolveFileOwnerNoteId(explicitNoteId?: string | null): string {
  if (explicitNoteId && explicitNoteId !== '0') {
    return explicitNoteId
  }

  if (typeof window === 'undefined') {
    return ''
  }

  const currentPath = window.location.pathname

  if (/^\/[^/]+\/n\/[^/]+$/.test(currentPath) || /^\/n\/[^/]+$/.test(currentPath)) {
    const pathParts = currentPath.split('/')
    return pathParts[pathParts.length - 1] || ''
  }

  return ''
}

export function useNoteEditor(options: {
  getCurrentNoteId?: () => string
} = {}) {
  const editor = ref<Editor | null>(null)
  const inputMode = ref<'text' | 'none'>('text')
  const { addNoteFile, getNoteFileByHash } = useNoteFiles()
  const activeAttachmentHashes = new Set<string>()

  function buildEditorProps(): EditorProps {
    return {
      attributes: {
        // Framework7 active-state DOM mutations break native caret placement in ProseMirror.
        class: 'no-active-state',
        inputmode: inputMode.value,
      },
      handleClick: handleEditableLinkClick,
      handleDrop: (view, event) => handleAttachmentDrop(view, event, insertFiles),
      handlePaste: (_view, event) => handleAttachmentPaste(event, insertFiles),
    }
  }

  function isHashValue(str: string): boolean {
    return /^[a-f0-9]{64}$/i.test(str)
  }

  async function loadFileFromStorage(hashOrFilename: string, loadOptions: { force?: boolean } = {}) {
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
        throw new Error(`本地附件不存在: ${hashOrFilename}`)
      }
      else {
        const noteId = resolveFileOwnerNoteId(options.getCurrentNoteId?.())
        const remoteFilename = getRemoteAttachmentFilename(hashOrFilename)

        if (noteId) {
          const localFile = await resolveStoredRemoteAttachment(noteId, remoteFilename)
          if (localFile?.file) {
            return {
              url: URL.createObjectURL(localFile.file),
              type: localFile.file.type,
            }
          }

          try {
            await hydrateRemoteAttachment(noteId, remoteFilename, loadOptions)
            const hydratedFile = await resolveStoredRemoteAttachment(noteId, remoteFilename)
            if (hydratedFile?.file) {
              return {
                url: URL.createObjectURL(hydratedFile.file),
                type: hydratedFile.file.type,
              }
            }
          }
          catch (error) {
            console.warn(`附件本地化失败，回退远端读取: ${remoteFilename}`, error)
          }

          const result = await noteRemoteService.getFileByFilename(noteId, remoteFilename)
          if (result) {
            return {
              url: result.url,
              type: result.type,
            }
          }
        }

        console.warn(`PocketBase文件未找到: ${remoteFilename}`)
        throw new Error(`远程附件不存在: ${remoteFilename}`)
      }
    }
    catch (error) {
      console.error('加载文件失败:', error)
      throw error
    }
  }

  function initEditor(options: {
    onFocus?: () => void
    onBlur?: () => void
  } = {}) {
    editor.value = new Editor({
      extensions: [
        Color.configure({ types: [TextStyleKit.name, ListItem.name] }),
        TextStyleKit.configure({ color: false }),
        StarterKit.configure({
          link: false,
        }),
        AttachmentAwareLink.configure({ openOnClick: false }),
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
      editorProps: buildEditorProps(),
      onBlur: options.onBlur,
      onFocus: options.onFocus,
    })
  }

  async function insertFiles(files: ArrayLike<File>, position?: number): Promise<string[]> {
    if (!editor.value)
      return []

    const insertedHashes: string[] = []
    let nextPosition = position

    for (const file of Array.from(files)) {
      try {
        const hash = await getFileHash(file)
        const existingFile = await getNoteFileByHash(hash)
        if (!existingFile) {
          await addNoteFile(file, hash)
        }

        const inserted = nextPosition === undefined
          ? editor.value.commands.setFileUpload({
              url: hash,
              name: file.name,
              size: file.size,
              type: file.type,
            })
          : editor.value.commands.insertContentAt(nextPosition, {
              type: 'fileUpload',
              attrs: {
                url: hash,
                name: file.name,
                size: file.size,
                type: file.type,
              },
            })

        if (!inserted) {
          continue
        }

        insertedHashes.push(hash)
        if (!activeAttachmentHashes.has(hash)) {
          activeAttachmentHashes.add(hash)
          registerActiveAttachmentHash(hash)
        }
        if (nextPosition !== undefined) {
          nextPosition += 1
        }
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

    return extractAttachmentReferences(editor.value.getHTML()).hashes
  }

  function releaseUnreferencedAttachmentHashes(content: string) {
    const referencedHashes = new Set(extractAttachmentReferences(content).hashes)
    const releasedHashes = [...activeAttachmentHashes]
      .filter(hash => !referencedHashes.has(hash))

    if (releasedHashes.length === 0) {
      return []
    }

    releasedHashes.forEach(hash => activeAttachmentHashes.delete(hash))
    unregisterActiveAttachmentHashes(releasedHashes)
    return releasedHashes
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

  function setInputMode(mode: 'text' | 'none') {
    inputMode.value = mode
    editor.value?.setOptions({
      editorProps: buildEditorProps(),
    })
  }

  function destroyEditor() {
    editor.value?.destroy()
    editor.value = null
  }

  onBeforeUnmount(() => {
    unregisterActiveAttachmentHashes(activeAttachmentHashes)
    destroyEditor()
  })

  return {
    editor: computed(() => editor.value),
    initEditor,
    insertFiles,
    extractFileHashes,
    releaseUnreferencedAttachmentHashes,
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
