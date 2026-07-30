import type { EditorView } from '@tiptap/pm/view'

export type InsertTransferredFiles = (files: readonly File[], position?: number) => Promise<unknown> | unknown

export function getTransferredFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) {
    return []
  }

  const itemFiles = Array.from(dataTransfer.items || [])
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter((file): file is File => Boolean(file))

  if (itemFiles.length > 0) {
    return itemFiles
  }

  return Array.from(dataTransfer.files || [])
}

function insertTransferredFiles(
  event: ClipboardEvent | DragEvent,
  files: readonly File[],
  insertFiles: InsertTransferredFiles,
  position?: number,
): boolean {
  if (files.length === 0) {
    return false
  }

  event.preventDefault()
  void Promise.resolve(insertFiles(files, position)).catch((error) => {
    console.error('插入附件失败:', error)
  })
  return true
}

export function handleAttachmentPaste(event: ClipboardEvent, insertFiles: InsertTransferredFiles): boolean {
  return insertTransferredFiles(event, getTransferredFiles(event.clipboardData), insertFiles)
}

export function handleAttachmentDrop(
  view: Pick<EditorView, 'posAtCoords'>,
  event: DragEvent,
  insertFiles: InsertTransferredFiles,
): boolean {
  const files = getTransferredFiles(event.dataTransfer)
  if (files.length === 0) {
    return false
  }

  const dropPosition = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
  return insertTransferredFiles(event, files, insertFiles, dropPosition)
}
