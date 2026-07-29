import type { Note } from '@/shared/types'
import { ref } from 'vue'

type MaybePromise<T> = T | Promise<T>

export interface UseNoteDetailPrivateOptions {
  getNote: (id: string) => MaybePromise<Note | null | undefined>
  onLoaded: (note: Note) => MaybePromise<void>
  onMissing: () => MaybePromise<void>
  repairMissingPrivateNoteIfNeeded?: (id: string) => MaybePromise<boolean>
}

export function useNoteDetailPrivate(options: UseNoteDetailPrivateOptions) {
  const repairingNoteId = ref<string | null>(null)
  let activeNoteId: string | null = null
  let requestVersion = 0

  function beginRequest(noteId: string) {
    activeNoteId = noteId
    requestVersion += 1
    return requestVersion
  }

  function isCurrentRequest(noteId: string, version: number) {
    return activeNoteId === noteId && requestVersion === version
  }

  function reset() {
    activeNoteId = null
    requestVersion += 1
    repairingNoteId.value = null
  }

  async function loadPrivateNote(id: string) {
    const version = beginRequest(id)
    const note = await options.getNote(id)
    if (!isCurrentRequest(id, version)) {
      return null
    }

    if (note) {
      repairingNoteId.value = null
      await options.onLoaded(note)
      return note
    }

    await options.onMissing()
    if (isCurrentRequest(id, version)) {
      void repairMissingPrivateNote(id, version)
    }
    return null
  }

  async function repairMissingPrivateNote(id: string, requestVersionOverride?: number) {
    const version = requestVersionOverride
      ?? (activeNoteId === id ? requestVersion : beginRequest(id))

    if (!isCurrentRequest(id, version)) {
      return null
    }

    if (repairingNoteId.value === id) {
      return null
    }

    repairingNoteId.value = id

    try {
      const repaired = await options.repairMissingPrivateNoteIfNeeded?.(id)
      if (!repaired || !isCurrentRequest(id, version)) {
        return null
      }

      const repairedNote = await options.getNote(id)
      if (!repairedNote || !isCurrentRequest(id, version)) {
        return null
      }

      repairingNoteId.value = null
      await options.onLoaded(repairedNote)
      return repairedNote
    }
    catch (error) {
      console.error('缺失私有备忘录补齐失败:', error)
      return null
    }
    finally {
      if (repairingNoteId.value === id) {
        repairingNoteId.value = null
      }
    }
  }

  return {
    loadPrivateNote,
    repairingNoteId,
    repairMissingPrivateNote,
    reset,
  }
}
