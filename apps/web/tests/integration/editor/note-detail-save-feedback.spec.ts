import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { deferred, mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('note detail save feedback integration (t-fn-028 / tc-fn-020, tc-fn-021)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps silent desktop note switch save hidden from the header spinner', async () => {
    const pendingUpdate = deferred<void>()
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: 'note-1',
      isDesktop: true,
      notesById: {
        'note-1': {
          id: 'note-1',
          title: '测试备忘录',
          summary: '测试摘要',
          content: '<p>旧内容</p>',
          created: '2026-03-08 10:00:00',
          updated: '2026-03-08 10:00:00',
          item_type: 0,
          parent_id: '',
          is_deleted: 0,
          is_locked: 0,
          note_count: 0,
          version: 1,
          files: [],
        },
        'note-2': {
          id: 'note-2',
          title: '第二条备忘录',
          summary: '第二条摘要',
          content: '<p>第二条</p>',
          created: '2026-03-08 10:00:00',
          updated: '2026-03-08 10:00:00',
          item_type: 0,
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

    editorApi.getContent.mockReturnValue('<p>切换前已修改</p>')

    await wrapper.setProps({ noteId: 'note-2' })
    await flushPromises()

    expect(mocks.updateNoteMock).toHaveBeenCalledTimes(1)
    expect(mocks.updateNoteMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      content: '<p>切换前已修改</p>',
    }))
    expect(wrapper.find('.note-detail__saving-spinner').exists()).toBe(false)
    expect(mocks.syncMock).not.toHaveBeenCalled()

    pendingUpdate.resolve()
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.note-detail__saving-spinner').exists()).toBe(false)
    expect(mocks.syncMock).not.toHaveBeenCalled()
  })

  it('shows a top error toast when cloud sync fails after local save', async () => {
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      syncImpl: async () => {
        throw new Error('sync failed')
      },
    })

    editorApi.getContent.mockReturnValue('<p>同步失败内容</p>')

    wrapper.getComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await nextTick()
    vi.advanceTimersByTime(800)
    await flushPromises()
    await nextTick()

    expect(mocks.updateNoteMock).toHaveBeenCalledTimes(1)
    expect(mocks.syncMock).toHaveBeenCalledWith(true)
    expect(mocks.toastCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'note-detail-error-toast',
      message: '同步失败，请检查网络连接',
      position: 'top',
      color: 'danger',
    }))
    expect(mocks.toastPresentMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.note-detail__saving-spinner').exists()).toBe(false)
  })
})
