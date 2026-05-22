import type { Note } from '@/shared/types'

export interface NoteDetailEditorHost {
  applyDefaultNewNoteHeading?: () => boolean
  focus?: () => void
  setContent: (content: string) => void
  setEditable: (editable: boolean) => void
}

export interface UseNoteDetailEditorStateOptions {
  getEditor: () => NoteDetailEditorHost | null | undefined
  setLastSavedContent: (content: string) => void
}

export function useNoteDetailEditorState(options: UseNoteDetailEditorStateOptions) {
  function applyWithEditor(effect: (editor: NoteDetailEditorHost) => void) {
    const editor = options.getEditor()
    if (editor) {
      effect(editor)
      return
    }

    queueMicrotask(() => {
      const queuedEditor = options.getEditor()
      if (!queuedEditor) {
        return
      }

      effect(queuedEditor)
    })
  }

  function showNewDraft() {
    const editor = options.getEditor()
    if (!editor) {
      return
    }

    editor.setContent('')
    editor.setEditable(true)
    editor.applyDefaultNewNoteHeading?.()
    editor.focus?.()
  }

  function showMissingPrivateNote() {
    const editor = options.getEditor()
    if (!editor) {
      return
    }

    editor.setContent('')
    editor.setEditable(false)
  }

  function showLockedNote() {
    const editor = options.getEditor()
    if (!editor) {
      return
    }

    editor.setContent('')
    editor.setEditable(false)
  }

  function showReadOnlyNote(note: Note) {
    applyWithEditor((editor) => {
      editor.setEditable(false)
      editor.setContent(note.content || '')
      options.setLastSavedContent(note.content || '')
    })
  }

  function showUnlockedNote(note: Note) {
    applyWithEditor((editor) => {
      editor.setEditable(note.is_deleted !== 1)
      editor.setContent(note.content || '')
      options.setLastSavedContent(note.content || '')
    })
  }

  function clearSelection() {
    queueMicrotask(() => {
      const editor = options.getEditor()
      if (!editor) {
        return
      }

      editor.setContent('')
      editor.setEditable(true)
    })
  }

  return {
    clearSelection,
    showLockedNote,
    showMissingPrivateNote,
    showNewDraft,
    showReadOnlyNote,
    showUnlockedNote,
  }
}
