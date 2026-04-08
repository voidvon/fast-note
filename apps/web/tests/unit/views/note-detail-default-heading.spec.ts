import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('note detail default heading init (t-fn-046 / tc-fn-039, tc-fn-043)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies the default heading when entering a new note detail', async () => {
    const { editorApi } = await mountNoteDetailForSaveTest({
      noteId: '',
      route: {
        params: {
          id: '0',
        },
      },
      notesById: {},
    })

    expect(editorApi.setContent).toHaveBeenCalledWith('')
    expect(editorApi.setEditable).toHaveBeenCalledWith(true)
    expect(editorApi.applyDefaultNewNoteHeading).toHaveBeenCalledTimes(1)
  })

  it('does not apply the default heading when loading an existing note', async () => {
    const { editorApi } = await mountNoteDetailForSaveTest()

    expect(editorApi.applyDefaultNewNoteHeading).not.toHaveBeenCalled()
    expect(editorApi.setContent).toHaveBeenCalledWith('<p>旧内容</p>')
  })
})
