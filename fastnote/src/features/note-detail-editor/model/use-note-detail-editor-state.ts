import type { Note } from '@/shared/types'

export interface NoteDetailEditorHost {
  applyDefaultNewNoteHeading?: () => boolean
  focus?: () => void
  setContent: (content: string) => void
  setEditable: (editable: boolean) => void
}

export interface UseNoteDetailEditorStateOptions {
  getEditor: () => NoteDetailEditorHost | null | undefined
  onUnlockedNoteApplied?: (note: Note) => void
  setLastSavedContent: (content: string) => void
}

export function useNoteDetailEditorState(options: UseNoteDetailEditorStateOptions) {
  let effectVersion = 0

  function beginEffect() {
    effectVersion += 1
    return effectVersion
  }

  function applyWithEditor(effect: (editor: NoteDetailEditorHost) => void) {
    const version = beginEffect()
    const editor = options.getEditor()
    if (editor) {
      effect(editor)
      return
    }

    queueMicrotask(() => {
      if (version !== effectVersion) {
        return
      }

      const queuedEditor = options.getEditor()
      if (!queuedEditor) {
        return
      }

      effect(queuedEditor)
    })
  }

  function showNewDraft() {
    beginEffect()
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
    beginEffect()
    const editor = options.getEditor()
    if (!editor) {
      return
    }

    editor.setContent('')
    editor.setEditable(false)
  }

  function showLockedNote() {
    beginEffect()
    const editor = options.getEditor()
    if (!editor) {
      return
    }

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
      options.onUnlockedNoteApplied?.(note)
    })
  }

  function clearSelection() {
    const version = beginEffect()
    queueMicrotask(() => {
      if (version !== effectVersion) {
        return
      }

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
