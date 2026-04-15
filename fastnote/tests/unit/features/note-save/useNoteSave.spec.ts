import { describe, expect, it, vi } from 'vitest'
import { useNoteSave } from '@/features/note-save'
import { makeNote } from '../../../factories/note.factory'

function createEditor(overrides: Partial<{
  getContent: () => string
  getTitle: () => { title: string, summary: string }
  isMeaningfulContent: () => boolean
}> = {}) {
  return {
    getContent: overrides.getContent || (() => '<p>新内容</p>'),
    getTitle: overrides.getTitle || (() => ({
      title: '新标题',
      summary: '新摘要',
    })),
    isMeaningfulContent: overrides.isMeaningfulContent || (() => true),
  }
}

describe('useNoteSave', () => {
  it('updates an existing note and triggers follow-up sync', async () => {
    const note = makeNote({
      id: 'note-1',
      title: '旧标题',
      summary: '旧摘要',
      content: '<p>旧内容</p>',
      version: 1,
    })
    const updateNote = vi.fn(async () => undefined)
    const setCurrentNote = vi.fn()
    const emitNoteSaved = vi.fn()
    const sync = vi.fn(async () => undefined)
    const presentTopError = vi.fn(async () => undefined)

    const noteSave = useNoteSave({
      addNote: vi.fn(async () => undefined),
      getNote: vi.fn(async () => note),
      updateNote,
      updateParentFolderSubcount: vi.fn(async () => undefined),
      sync,
      restoreHeight: vi.fn(),
      presentTopError,
      emitNoteSaved,
      getCurrentNote: () => note,
      setCurrentNote,
      getNow: () => '2026-03-17 12:00:00',
    })

    noteSave.lastSavedContent.value = '<p>旧内容</p>'

    await noteSave.saveNote({
      editor: createEditor(),
      effectiveUuid: 'note-1',
      isNewNote: false,
      isDesktop: false,
    })

    expect(updateNote).toHaveBeenCalledWith('note-1', expect.objectContaining({
      title: '新标题',
      summary: '新摘要',
      content: '<p>新内容</p>',
      updated: '2026-03-17 12:00:00',
      version: 2,
      files: [],
    }))
    expect(setCurrentNote).toHaveBeenCalledWith(expect.objectContaining({
      id: 'note-1',
      title: '新标题',
    }))
    expect(emitNoteSaved).toHaveBeenCalledWith({
      noteId: 'note-1',
      isNew: false,
    })
    expect(sync).toHaveBeenCalledWith(true)
    expect(presentTopError).not.toHaveBeenCalled()
    expect(noteSave.lastSavedContent.value).toBe('<p>新内容</p>')
    expect(noteSave.isSaving.value).toBe(false)
  })

  it('does not create a persisted note for an empty new draft', async () => {
    const addNote = vi.fn(async () => undefined)
    const flushNotesToLocal = vi.fn(async () => undefined)

    const noteSave = useNoteSave({
      addNote,
      getNote: vi.fn(async () => null),
      updateNote: vi.fn(async () => undefined),
      updateParentFolderSubcount: vi.fn(async () => undefined),
      sync: vi.fn(async () => undefined),
      restoreHeight: vi.fn(),
      presentTopError: vi.fn(async () => undefined),
      flushNotesToLocal,
      getNow: () => '2026-03-17 12:05:00',
    })

    await noteSave.saveNote({
      editor: createEditor({
        getContent: () => '<h1></h1>',
        getTitle: () => ({
          title: '',
          summary: '',
        }),
        isMeaningfulContent: () => false,
      }),
      effectiveUuid: 'draft-1',
      isNewNote: true,
      isDesktop: false,
      leaveFlushReason: 'view-leave',
    })

    expect(addNote).not.toHaveBeenCalled()
    expect(flushNotesToLocal).toHaveBeenCalledWith('view-leave')
  })

  it('switches to missing-note state when saving a removed private note', async () => {
    const setMissingPrivateNote = vi.fn()
    const setCurrentNote = vi.fn()
    const onMissingPrivateNote = vi.fn()
    const presentTopError = vi.fn(async () => undefined)

    const noteSave = useNoteSave({
      addNote: vi.fn(async () => undefined),
      getNote: vi.fn(async () => null),
      updateNote: vi.fn(async () => undefined),
      updateParentFolderSubcount: vi.fn(async () => undefined),
      sync: vi.fn(async () => undefined),
      restoreHeight: vi.fn(),
      presentTopError,
      setMissingPrivateNote,
      setCurrentNote,
      onMissingPrivateNote,
      getNow: () => '2026-03-17 12:10:00',
    })

    await noteSave.saveNote({
      editor: createEditor(),
      effectiveUuid: 'missing-note',
      isNewNote: false,
      isDesktop: false,
    })

    expect(setMissingPrivateNote).toHaveBeenCalledWith(true)
    expect(setCurrentNote).toHaveBeenCalledWith(null)
    expect(onMissingPrivateNote).toHaveBeenCalledTimes(1)
    expect(presentTopError).toHaveBeenCalledWith('当前备忘录不存在或尚未同步完成')
  })
})
