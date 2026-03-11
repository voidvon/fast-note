import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('new note default heading integration (t-fn-049 / tc-fn-044)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes a new note with the default heading and focuses the editor', async () => {
    const { editorApi } = await mountNoteDetailForSaveTest({
      noteId: '',
      route: {
        params: {
          id: '0',
        },
      },
      notesById: {},
    })

    vi.advanceTimersByTime(120)
    await flushPromises()
    await nextTick()

    expect(editorApi.applyDefaultNewNoteHeading).toHaveBeenCalledTimes(1)
    expect(editorApi.focus).toHaveBeenCalledTimes(1)
  })

  it('does not persist a blank default heading on view leave flush', async () => {
    const { editorApi, mocks, triggerIonViewWillLeave } = await mountNoteDetailForSaveTest({
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

    await triggerIonViewWillLeave()

    expect(mocks.addNoteMock).not.toHaveBeenCalled()
    expect(mocks.manualSyncMock).toHaveBeenCalledTimes(1)
  })
})
