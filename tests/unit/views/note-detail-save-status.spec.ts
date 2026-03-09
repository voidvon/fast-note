import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { deferred, mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('note detail save status (t-fn-028 / tc-fn-020, tc-fn-021)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows header spinner while blur save is pending and hides it after success', async () => {
    const pendingUpdate = deferred<void>()
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      updateNoteImpl: async () => pendingUpdate.promise,
    })

    editorApi.getContent.mockReturnValue('<p>新内容</p>')

    wrapper.getComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await nextTick()
    vi.advanceTimersByTime(800)
    await flushPromises()

    expect(wrapper.find('.note-detail__saving-spinner').exists()).toBe(true)
    expect(mocks.updateNoteMock).toHaveBeenCalledTimes(1)
    expect(mocks.syncMock).not.toHaveBeenCalled()

    pendingUpdate.resolve()
    await flushPromises()
    await nextTick()

    expect(mocks.syncMock).toHaveBeenCalledWith(true)
    expect(wrapper.find('.note-detail__saving-spinner').exists()).toBe(false)
  })

  it('shows top error toast when local save fails', async () => {
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      updateNoteImpl: async () => {
        throw new Error('save failed')
      },
    })

    editorApi.getContent.mockReturnValue('<p>保存失败内容</p>')

    wrapper.getComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await nextTick()
    vi.advanceTimersByTime(800)
    await flushPromises()
    await nextTick()

    expect(mocks.toastDismissMock).toHaveBeenCalledWith(undefined, undefined, 'note-detail-error-toast')
    expect(mocks.toastCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'note-detail-error-toast',
      message: '保存失败，请重试',
      position: 'top',
      color: 'danger',
    }))
    expect(mocks.toastPresentMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.note-detail__saving-spinner').exists()).toBe(false)
  })

  it('updates mobile new-note URL without triggering vue-router navigation on first save', async () => {
    const replaceStateMock = vi.spyOn(window.history, 'replaceState')

    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: '',
      isDesktop: false,
      route: {
        params: {
          id: '0',
        },
        query: {
          parent_id: 'folder-1',
        },
      },
      notesById: {},
    })

    editorApi.getContent.mockReturnValue('<p>新建内容</p>')
    editorApi.getTitle.mockReturnValue({
      title: '新建备忘录',
      summary: '新建摘要',
    })

    wrapper.getComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await nextTick()
    vi.advanceTimersByTime(800)
    await flushPromises()
    await nextTick()

    expect(mocks.addNoteMock).toHaveBeenCalledTimes(1)

    const savedNoteId = mocks.addNoteMock.mock.calls[0][0].id
    expect(mocks.routerReplaceMock).not.toHaveBeenCalled()
    expect(replaceStateMock).toHaveBeenCalledWith(null, '', `/n/${savedNoteId}`)

    replaceStateMock.mockRestore()
  })
})
