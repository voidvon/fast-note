import type { Note } from '@/shared/types'

type MaybePromise<T> = T | Promise<T>

export interface UseNoteDetailEntryOptions {
  applyPublicNote: (note: Note | null | undefined) => MaybePromise<void>
  clearSelection: () => MaybePromise<void>
  createDraftId: () => string
  enterNewDraft: (draftId: string) => MaybePromise<void>
  getPublicNote: (id: string) => Note | null | undefined
  loadPrivateNote: (id: string) => MaybePromise<unknown>
  resetLockView: () => MaybePromise<void>
  resetMissingPrivateNote: () => MaybePromise<void>
}

export function useNoteDetailEntry(options: UseNoteDetailEntryOptions) {
  async function openExisting(id: string, isUserContext: boolean) {
    await options.resetMissingPrivateNote()

    if (isUserContext) {
      await options.applyPublicNote(options.getPublicNote(id))
      return
    }

    await options.loadPrivateNote(id)
  }

  async function openNewDraft() {
    await options.resetMissingPrivateNote()
    await options.resetLockView()
    const draftId = options.createDraftId()
    await options.enterNewDraft(draftId)
    return draftId
  }

  async function clearDetailSelection() {
    await options.resetMissingPrivateNote()
    await options.resetLockView()
    await options.clearSelection()
  }

  return {
    clearDetailSelection,
    openExisting,
    openNewDraft,
  }
}
