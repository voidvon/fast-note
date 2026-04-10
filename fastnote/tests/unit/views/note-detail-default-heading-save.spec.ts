import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('note detail default heading save guard (t-fn-048 / tc-fn-041, tc-fn-042)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not create a note when the editor only contains the default empty heading', async () => {
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: '',
      route: {
        params: {
          id: '0',
        },
      },
      notesById: {},
    })

    editorApi.getContent.mockReturnValue('<h1></h1>')
    editorApi.isMeaningfulContent.mockReturnValue(false)
    editorApi.getTitle.mockReturnValue({
      title: '',
      summary: '',
    })

    wrapper.getComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await nextTick()
    vi.advanceTimersByTime(800)
    await flushPromises()

    expect(mocks.addNoteMock).not.toHaveBeenCalled()
    expect(mocks.deleteNoteMock).not.toHaveBeenCalled()
    expect(mocks.syncMock).not.toHaveBeenCalled()
  })

  it('creates a new note once the default heading has real text', async () => {
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: '',
      route: {
        params: {
          id: '0',
        },
      },
      notesById: {},
    })

    editorApi.getContent.mockReturnValue('<h1>新的一级标题</h1>')
    editorApi.isMeaningfulContent.mockReturnValue(true)
    editorApi.getTitle.mockReturnValue({
      title: '新的一级标题',
      summary: '',
    })

    wrapper.getComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await nextTick()
    vi.advanceTimersByTime(800)
    await flushPromises()

    expect(mocks.addNoteMock).toHaveBeenCalledTimes(1)
    expect(mocks.addNoteMock).toHaveBeenCalledWith(expect.objectContaining({
      title: '新的一级标题',
      content: '<h1>新的一级标题</h1>',
    }))
    expect(mocks.syncMock).toHaveBeenCalledWith(true)
  })
})
