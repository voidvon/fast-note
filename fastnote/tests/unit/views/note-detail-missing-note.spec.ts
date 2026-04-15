import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('note detail missing note guard (t-fn-030 / tc-fn-024)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('blocks creating a note when private route misses existing note id', async () => {
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: 'missing-note',
      notesById: {},
      getNoteImpl: async () => null,
    })

    await nextTick()
    expect(wrapper.find('[data-testid="note-detail-missing-note"]').exists()).toBe(true)
    expect(editorApi.setEditable).toHaveBeenCalledWith(false)

    editorApi.getContent.mockReturnValue('<p>尝试保存缺失备忘录</p>')

    wrapper.getComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await nextTick()
    vi.advanceTimersByTime(800)
    await flushPromises()
    await nextTick()

    expect(mocks.addNoteMock).not.toHaveBeenCalled()
    expect(mocks.updateNoteMock).not.toHaveBeenCalled()
    expect(mocks.updateParentFolderSubcountMock).not.toHaveBeenCalled()
    expect(mocks.syncMock).not.toHaveBeenCalled()
    expect(mocks.toastCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'note-detail-error-toast',
      message: '当前备忘录不存在或尚未同步完成',
      position: 'top',
      color: 'danger',
    }))
  })
})
