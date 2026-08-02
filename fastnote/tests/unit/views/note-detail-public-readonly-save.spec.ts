import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NOTE_TYPE } from '@/shared/types'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('note detail public read-only persistence boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('never writes public editor content into a private note with the same id on leave', async () => {
    const privateNote = {
      id: 'note-1',
      title: '刚编辑的标题',
      summary: '刚编辑的摘要',
      content: '<p>尚未同步的本地正文</p>',
      created: '2026-07-31 10:00:00',
      updated: '2026-07-31 10:05:00',
      item_type: NOTE_TYPE.NOTE,
      parent_id: '',
      is_deleted: 0,
      is_locked: 0,
      note_count: 0,
      version: 1,
      files: [],
    }
    const publicNote = {
      ...privateNote,
      content: '',
      updated: '2026-07-31 10:00:00',
    }
    const { editorApi, mocks, triggerF7ViewWillLeave, wrapper } = await mountNoteDetailForSaveTest({
      noteId: 'note-1',
      route: {
        params: {
          username: 'voidvon',
          noteId: 'note-1',
        },
      },
      notesById: {
        'note-1': privateNote,
      },
      publicNotesById: {
        'note-1': publicNote,
      },
    })

    // Tiptap serializes an empty document as <p></p>, while PocketBase may
    // return an empty string. That representation mismatch used to force a save.
    editorApi.getContent.mockReturnValue('<p></p>')

    await triggerF7ViewWillLeave()

    expect(mocks.updateNoteMock).not.toHaveBeenCalled()
    expect(mocks.manualSyncMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('still saves a private pane while the global route is changing to a public URL', async () => {
    const { editorApi, mocks, route, triggerF7ViewWillLeave, wrapper } = await mountNoteDetailForSaveTest({
      noteId: 'note-1',
      route: {
        params: {
          id: 'note-1',
        },
      },
    })

    editorApi.getContent.mockReturnValue('<p>切换前最新内容</p>')
    editorApi.getTitle.mockReturnValue({
      title: '切换前标题',
      summary: '切换前摘要',
    })
    route.params = {
      username: 'voidvon',
      noteId: 'note-1',
    }

    await triggerF7ViewWillLeave()

    expect(mocks.updateNoteMock).toHaveBeenCalledWith('note-1', expect.objectContaining({
      content: '<p>切换前最新内容</p>',
    }))
    expect(mocks.manualSyncMock).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
