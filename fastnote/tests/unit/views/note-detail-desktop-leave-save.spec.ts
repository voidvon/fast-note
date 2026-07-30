import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { NOTE_TYPE } from '@/shared/types'
import { deferred, mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

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

  it('opens the next desktop note without waiting for the previous save to finish', async () => {
    const pendingUpdate = deferred<void>()
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: 'note-1',
      isDesktop: true,
      notesById: {
        'note-1': {
          id: 'note-1',
          title: '第一条',
          summary: '第一条摘要',
          content: '<p>第一条旧内容</p>',
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
        'note-2': {
          id: 'note-2',
          title: '第二条',
          summary: '第二条摘要',
          content: '<p>第二条内容</p>',
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
      updateNoteImpl: async () => pendingUpdate.promise,
    })

    editorApi.getContent.mockReturnValue('<p>切换前尚未保存</p>')
    editorApi.getTitle.mockReturnValue({
      title: '切换前标题',
      summary: '切换前摘要',
    })

    await wrapper.setProps({ noteId: 'note-2' })
    await flushPromises()
    await nextTick()

    expect(mocks.updateNoteMock).toHaveBeenCalledWith('note-1', expect.objectContaining({
      content: '<p>切换前尚未保存</p>',
    }))
    expect(mocks.getNoteMock).toHaveBeenCalledWith('note-2')
    expect(editorApi.setContent).toHaveBeenLastCalledWith('<p>第二条内容</p>')

    pendingUpdate.resolve()
    await flushPromises()
  })

  it('clears the desktop editor when selection is removed even if the route still has the old note id', async () => {
    const { wrapper } = await mountNoteDetailForSaveTest({
      noteId: 'note-1',
      isDesktop: true,
      route: {
        params: {
          id: 'note-1',
        },
      },
    })

    expect(wrapper.find('.yy-editor-stub').exists()).toBe(true)

    await wrapper.setProps({ noteId: '' })
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.yy-editor-stub').exists()).toBe(false)
  })
})
