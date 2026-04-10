import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { NOTE_TYPE } from '@/shared/types'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('note detail empty note blur guard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not delete an existing saved empty note on blur without edits', async () => {
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: 'empty-note',
      notesById: {
        'empty-note': {
          id: 'empty-note',
          title: '',
          summary: '',
          content: '',
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

    editorApi.getContent.mockReturnValue('')
    editorApi.getTitle.mockReturnValue({ title: '', summary: '' })
    editorApi.isMeaningfulContent.mockReturnValue(false)

    wrapper.getComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await nextTick()
    vi.advanceTimersByTime(800)
    await flushPromises()
    await nextTick()

    expect(mocks.deleteNoteMock).not.toHaveBeenCalled()
    expect(mocks.updateNoteMock).not.toHaveBeenCalled()
    expect(mocks.addNoteMock).not.toHaveBeenCalled()
    expect(mocks.syncMock).not.toHaveBeenCalled()
  })

  it('keeps an existing note when content is cleared on blur', async () => {
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: 'filled-note',
      notesById: {
        'filled-note': {
          id: 'filled-note',
          title: '原标题',
          summary: '原摘要',
          content: '<p>原内容</p>',
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

    editorApi.getContent.mockReturnValue('')
    editorApi.getTitle.mockReturnValue({ title: '', summary: '' })
    editorApi.isMeaningfulContent.mockReturnValue(false)

    wrapper.getComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await nextTick()
    vi.advanceTimersByTime(800)
    await flushPromises()
    await nextTick()

    expect(mocks.deleteNoteMock).not.toHaveBeenCalled()
    expect(mocks.updateNoteMock).toHaveBeenCalledWith('filled-note', expect.objectContaining({
      title: '新建备忘录',
      summary: '',
      content: '',
    }))
    expect(mocks.syncMock).toHaveBeenCalledWith(true)
  })
})
