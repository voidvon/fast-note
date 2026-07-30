import { describe, expect, it, vi } from 'vitest'
import {
  getTransferredFiles,
  handleAttachmentDrop,
  handleAttachmentPaste,
} from '@/features/note-editor'

function createDataTransfer(options: {
  items?: Array<Partial<DataTransferItem>>
  files?: File[]
}): DataTransfer {
  return {
    items: options.items || [],
    files: options.files || [],
  } as unknown as DataTransfer
}

function createPasteEvent(clipboardData: DataTransfer): ClipboardEvent {
  const event = new Event('paste', { cancelable: true }) as ClipboardEvent
  Object.defineProperty(event, 'clipboardData', { value: clipboardData })
  return event
}

function createDropEvent(dataTransfer: DataTransfer, clientX = 20, clientY = 40): DragEvent {
  const event = new Event('drop', { cancelable: true }) as DragEvent
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    dataTransfer: { value: dataTransfer },
  })
  return event
}

describe('note editor attachment transfer', () => {
  it('pastes image and non-image files as attachments', () => {
    const image = new File(['image'], 'clipboard.png', { type: 'image/png' })
    const archive = new File(['archive'], 'documents.zip', { type: 'application/zip' })
    const insertFiles = vi.fn()
    const event = createPasteEvent(createDataTransfer({
      items: [
        { kind: 'string', type: 'text/plain', getAsFile: () => null },
        { kind: 'file', type: 'image/png', getAsFile: () => image },
        { kind: 'file', type: 'application/zip', getAsFile: () => archive },
      ],
    }))

    expect(handleAttachmentPaste(event, insertFiles)).toBe(true)
    expect(event.defaultPrevented).toBe(true)
    expect(insertFiles).toHaveBeenCalledWith([image, archive], undefined)
  })

  it('falls back to the transferred file list for clipboard implementations without items', () => {
    const document = new File(['document'], 'notes.pdf', { type: 'application/pdf' })

    expect(getTransferredFiles(createDataTransfer({ files: [document] }))).toEqual([document])
  })

  it('inserts dropped files at the editor drop position', () => {
    const document = new File(['document'], 'notes.pdf', { type: 'application/pdf' })
    const insertFiles = vi.fn()
    const view = {
      posAtCoords: vi.fn(() => ({ pos: 12, inside: 10 })),
    }
    const event = createDropEvent(createDataTransfer({ files: [document] }))

    expect(handleAttachmentDrop(view, event, insertFiles)).toBe(true)
    expect(event.defaultPrevented).toBe(true)
    expect(view.posAtCoords).toHaveBeenCalledWith({ left: 20, top: 40 })
    expect(insertFiles).toHaveBeenCalledWith([document], 12)
  })

  it('leaves text paste and internal editor drags to Tiptap', () => {
    const insertFiles = vi.fn()
    const dataTransfer = createDataTransfer({
      items: [
        { kind: 'string', type: 'text/plain', getAsFile: () => null },
      ],
    })
    const pasteEvent = createPasteEvent(dataTransfer)
    const dropEvent = createDropEvent(dataTransfer)
    const view = { posAtCoords: vi.fn() }

    expect(handleAttachmentPaste(pasteEvent, insertFiles)).toBe(false)
    expect(handleAttachmentDrop(view, dropEvent, insertFiles)).toBe(false)
    expect(pasteEvent.defaultPrevented).toBe(false)
    expect(dropEvent.defaultPrevented).toBe(false)
    expect(view.posAtCoords).not.toHaveBeenCalled()
    expect(insertFiles).not.toHaveBeenCalled()
  })
})
