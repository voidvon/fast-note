import type { NoteLockViewState } from '@/features/note-lock'
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { useNoteDetailViewState } from '@/features/note-detail-view'
import { makeNote } from '../../../factories/note.factory'

describe('useNoteDetailViewState', () => {
  it('treats public note detail as read-only and hides note actions', () => {
    const state = reactive({
      note: makeNote({
        id: 'public-note',
      }),
      isMissingPrivateNote: false,
      isNewNote: false,
      isUserContext: true,
      lockViewState: 'unlocked' as NoteLockViewState,
    })
    const viewState = useNoteDetailViewState({
      getCurrentNote: () => state.note,
      getLockViewState: () => state.lockViewState,
      isNewNote: () => state.isNewNote,
      isPinLockNote: vi.fn(() => false),
      isUserContext: () => state.isUserContext,
      isMissingPrivateNoteState: () => state.isMissingPrivateNote,
    })

    expect(viewState.isReadOnly.value).toBe(true)
    expect(viewState.isEditorBlocked.value).toBe(true)
    expect(viewState.canShowNoteActions.value).toBe(false)
  })

  it('blocks editor when private note is missing outside new note flow', () => {
    const state = reactive({
      note: null,
      isMissingPrivateNote: true,
      isNewNote: false,
      isUserContext: false,
      lockViewState: 'unlocked' as NoteLockViewState,
    })
    const viewState = useNoteDetailViewState({
      getCurrentNote: () => state.note,
      getLockViewState: () => state.lockViewState,
      isNewNote: () => state.isNewNote,
      isPinLockNote: vi.fn(() => false),
      isUserContext: () => state.isUserContext,
      isMissingPrivateNoteState: () => state.isMissingPrivateNote,
    })

    expect(viewState.isMissingPrivateNote.value).toBe(true)
    expect(viewState.isEditorBlocked.value).toBe(true)
    expect(viewState.canShowNoteActions.value).toBe(false)
  })

  it('shows unlock panel state while locked private note is not yet unlocked', () => {
    const state = reactive({
      note: makeNote({
        id: 'locked-note',
        is_locked: 1,
      }),
      isMissingPrivateNote: false,
      isNewNote: false,
      isUserContext: false,
      lockViewState: 'locked' as NoteLockViewState,
    })
    const viewState = useNoteDetailViewState({
      getCurrentNote: () => state.note,
      getLockViewState: () => state.lockViewState,
      isNewNote: () => state.isNewNote,
      isPinLockNote: vi.fn(note => note.is_locked === 1),
      isUserContext: () => state.isUserContext,
      isMissingPrivateNoteState: () => state.isMissingPrivateNote,
    })

    expect(viewState.isPinLockedForView.value).toBe(true)
    expect(viewState.isEditorBlocked.value).toBe(true)
    expect(viewState.canShowNoteActions.value).toBe(false)

    state.lockViewState = 'unlocked'

    expect(viewState.isPinLockedForView.value).toBe(false)
    expect(viewState.isEditorBlocked.value).toBe(false)
    expect(viewState.canShowNoteActions.value).toBe(true)
  })
})
