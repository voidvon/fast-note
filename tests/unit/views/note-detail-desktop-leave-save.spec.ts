import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { NOTE_TYPE } from '@/types'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('note detail desktop leave save', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves the previous note when desktop selection changes away from it', async () => {
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: 'note-1',
      isDesktop: true,
      notesById: {
        'note-1': {
          id: 'note-1',
          title: '旧标题',
          summary: '旧摘要',
          content: '<p>旧内容</p>',
          created: '2026-03-08 10:00:00',
          updated: '2026-03-08 10:00:00',
          item_type: NOTE_TYPE.NOTE,
          parent_id: '',
          is_deleted: 0,
          is_locked: 0,
          note_count: 0,
          version: 1,
          files: [],
        },
      },
    })

    editorApi.getContent.mockReturnValue('<p>切换前最新内容</p>')
    editorApi.getTitle.mockReturnValue({
      title: '切换前标题',
      summary: '切换前摘要',
    })

    await wrapper.setProps({ noteId: '0' })
    await flushPromises()
    await nextTick()

    expect(mocks.updateNoteMock).toHaveBeenCalledWith('note-1', expect.objectContaining({
      title: '切换前标题',
      summary: '切换前摘要',
      content: '<p>切换前最新内容</p>',
    }))
    expect(mocks.addNoteMock).not.toHaveBeenCalled()
    expect(mocks.deleteNoteMock).not.toHaveBeenCalled()
  })
})
