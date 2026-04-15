import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useNoteDetailEditorState } from '@/features/note-detail-editor'
import { makeNote } from '../../../factories/note.factory'

describe('useNoteDetailEditorState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes a new draft with default heading and focus', async () => {
    const editor = {
      applyDefaultNewNoteHeading: vi.fn(() => true),
      focus: vi.fn(),
      setContent: vi.fn(),
      setEditable: vi.fn(),
    }
    const state = useNoteDetailEditorState({
      getEditor: () => editor,
      setLastSavedContent: vi.fn(),
    })

    state.showNewDraft()
    await nextTick()
    vi.advanceTimersByTime(120)

    expect(editor.setContent).toHaveBeenCalledWith('')
    expect(editor.setEditable).toHaveBeenCalledWith(true)
    expect(editor.applyDefaultNewNoteHeading).toHaveBeenCalledTimes(1)
    expect(editor.focus).toHaveBeenCalledTimes(1)
  })

  it('fills read-only note content and updates last saved snapshot', async () => {
    const editor = {
      setContent: vi.fn(),
      setEditable: vi.fn(),
    }
    const setLastSavedContent = vi.fn()
    const state = useNoteDetailEditorState({
      getEditor: () => editor,
      setLastSavedContent,
    })
    const note = makeNote({
      id: 'public-note',
      content: '<p>public</p>',
    })

    state.showReadOnlyNote(note)
    await nextTick()

    expect(editor.setEditable).toHaveBeenCalledWith(false)
    expect(editor.setContent).toHaveBeenCalledWith('<p>public</p>')
    expect(setLastSavedContent).toHaveBeenCalledWith('<p>public</p>')
  })

  it('clears content and blocks editing for missing or locked note states', () => {
    const editor = {
      setContent: vi.fn(),
      setEditable: vi.fn(),
    }
    const state = useNoteDetailEditorState({
      getEditor: () => editor,
      setLastSavedContent: vi.fn(),
    })

    state.showMissingPrivateNote()
    state.showLockedNote()

    expect(editor.setContent).toHaveBeenCalledTimes(2)
    expect(editor.setEditable).toHaveBeenNthCalledWith(1, false)
    expect(editor.setEditable).toHaveBeenNthCalledWith(2, false)
  })
})
