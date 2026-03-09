import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

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
})
