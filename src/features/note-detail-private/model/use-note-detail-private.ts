import type { Note } from '@/types'
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

  function reset() {
    repairingNoteId.value = null
  }

  async function loadPrivateNote(id: string) {
    const note = await options.getNote(id)
    if (note) {
      repairingNoteId.value = null
      await options.onLoaded(note)
      return note
    }

    await options.onMissing()
    void repairMissingPrivateNote(id)
    return null
  }

  async function repairMissingPrivateNote(id: string) {
    if (repairingNoteId.value === id) {
      return null
    }

    repairingNoteId.value = id

    try {
      const repaired = await options.repairMissingPrivateNoteIfNeeded?.(id)
      if (!repaired) {
        return null
      }

      const repairedNote = await options.getNote(id)
      if (!repairedNote) {
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
  }

  return {
    loadPrivateNote,
    repairingNoteId,
    repairMissingPrivateNote,
    reset,
  }
}
