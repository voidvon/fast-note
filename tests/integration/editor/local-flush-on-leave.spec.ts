import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { deferred, mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('note detail local flush on leave (t-fn-035 / tc-fn-026)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes latest local content on pagehide without waiting for blur save', async () => {
    const { editorApi, mocks } = await mountNoteDetailForSaveTest()

    editorApi.getContent.mockReturnValue('<p>页面关闭前最新内容</p>')

    window.dispatchEvent(new Event('pagehide'))
    await flushPromises()
    await nextTick()

    expect(mocks.updateNoteMock).toHaveBeenCalledTimes(1)
    expect(mocks.updateNoteMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      content: '<p>页面关闭前最新内容</p>',
    }))
    expect(mocks.manualSyncMock).toHaveBeenCalledTimes(1)
    expect(mocks.syncMock).not.toHaveBeenCalled()
  })

  it('forces local manualSync on ion leave even when content already saved in memory', async () => {
    const { wrapper, editorApi, mocks, triggerIonViewWillLeave } = await mountNoteDetailForSaveTest()

    editorApi.getContent.mockReturnValue('<p>已保存但尚未落库</p>')

    wrapper.getComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await nextTick()
    vi.advanceTimersByTime(800)
    await flushPromises()
    await nextTick()

    expect(mocks.updateNoteMock).toHaveBeenCalledTimes(1)
    expect(mocks.syncMock).toHaveBeenCalledWith(true)

    mocks.updateNoteMock.mockClear()
    mocks.manualSyncMock.mockClear()
    mocks.syncMock.mockClear()

    await triggerIonViewWillLeave()

    expect(mocks.updateNoteMock).not.toHaveBeenCalled()
    expect(mocks.manualSyncMock).toHaveBeenCalledTimes(1)
    expect(mocks.syncMock).not.toHaveBeenCalled()
  })

  it('starts route-leave save asynchronously without waiting for save success', async () => {
    const pendingUpdate = deferred<void>()
    const {
      editorApi,
      mocks,
      triggerBeforeRouteLeave,
      triggerIonViewWillLeave,
    } = await mountNoteDetailForSaveTest({
      updateNoteImpl: async () => pendingUpdate.promise,
    })

    editorApi.getContent.mockReturnValue('<p>返回时最新内容</p>')

    await triggerBeforeRouteLeave()

    expect(mocks.updateNoteMock).toHaveBeenCalledTimes(1)
    expect(mocks.updateNoteMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      content: '<p>返回时最新内容</p>',
    }))
    expect(mocks.syncMock).not.toHaveBeenCalled()

    await triggerIonViewWillLeave()

    expect(mocks.updateNoteMock).toHaveBeenCalledTimes(1)
    expect(mocks.manualSyncMock).not.toHaveBeenCalled()

    pendingUpdate.resolve()
    await flushPromises()
    await nextTick()

    expect(mocks.syncMock).toHaveBeenCalledWith(true)
  })

  it('clicking the top-left back button navigates immediately while save continues in background', async () => {
    const pendingUpdate = deferred<void>()
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      updateNoteImpl: async () => pendingUpdate.promise,
    })

    editorApi.getContent.mockReturnValue('<p>左上角返回时的最新内容</p>')

    await wrapper.get('[data-testid=\"note-detail-back-button\"]').trigger('click')

    expect(mocks.updateNoteMock).toHaveBeenCalledTimes(1)
    expect(mocks.updateNoteMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      content: '<p>左上角返回时的最新内容</p>',
    }))
    expect(mocks.routerBackMock).toHaveBeenCalledTimes(1)
    expect(mocks.syncMock).not.toHaveBeenCalled()

    pendingUpdate.resolve()
    await flushPromises()
    await nextTick()

    expect(mocks.syncMock).toHaveBeenCalledWith(true)
  })
})
