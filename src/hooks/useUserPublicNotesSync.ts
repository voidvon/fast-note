import { ref } from 'vue'
import { useUserPublicNotes } from '@/entities/public-note'
import { ensurePublicNotesReady, syncPublicNotesForUser } from '@/processes/public-notes/model/ensure-public-notes-ready'

export function useUserPublicNotesSync(username: string) {
  const { publicNotes } = useUserPublicNotes(username)
  const syncing = ref(false)

  // 同步指定用户的公开笔记
  async function syncUserPublicNotes() {
    if (!username)
      return

    syncing.value = true

    try {
      return await syncPublicNotesForUser(username)
    }
    catch (error) {
      console.error('同步用户公开笔记失败:', error)
      throw error
    }
    finally {
      syncing.value = false
    }
  }

  return {
    ensureReady: (force = false) => ensurePublicNotesReady(username, { force }),
    publicNotes,
    syncing,
    syncUserPublicNotes,
  }
}
