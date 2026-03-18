import type { NoteLockViewState } from '@/features/note-lock'
import type { Note } from '@/shared/types'
import { computed } from 'vue'

export interface UseNoteDetailViewStateOptions {
  getCurrentNote: () => Note | null | undefined
  getLockViewState: () => NoteLockViewState
  isNewNote: () => boolean
  isPinLockNote: (note: Note) => boolean
  isUserContext: () => boolean
  isMissingPrivateNoteState: () => boolean
}

export function useNoteDetailViewState(options: UseNoteDetailViewStateOptions) {
  const isMissingPrivateNote = computed(() => {
    return !options.isUserContext() && !options.isNewNote() && options.isMissingPrivateNoteState()
  })

  const isReadOnly = computed(() => {
    return options.isUserContext() || options.getCurrentNote()?.is_deleted === 1
  })

  const isPinLockedForView = computed(() => {
    const note = options.getCurrentNote()
    return !!note && options.isPinLockNote(note) && options.getLockViewState() !== 'unlocked'
  })

  const isEditorBlocked = computed(() => {
    return isReadOnly.value || isMissingPrivateNote.value || isPinLockedForView.value
  })

  const canShowNoteActions = computed(() => {
    return !isEditorBlocked.value && !!options.getCurrentNote()?.id
  })

  return {
    canShowNoteActions,
    isEditorBlocked,
    isMissingPrivateNote,
    isPinLockedForView,
    isReadOnly,
  }
}
