import { initializeUserPublicNotes, useUserPublicNotes } from '@/entities/public-note'
import { useUserCache } from '@/hooks/useUserCache'
import { notesApi } from '@/pocketbase'

const initializedUsers = new Set<string>()

export async function syncPublicNotesForUser(username: string) {
  if (!username)
    return { synced: 0, notes: [] }

  const { getPublicUserInfo } = useUserCache()
  const userInfo = await getPublicUserInfo(username)

  if (!userInfo) {
    return {
      synced: 0,
      notes: [],
    }
  }

  const notes = await notesApi.getPublicNotes(userInfo.id)
  const { publicNotes } = useUserPublicNotes(username)
  publicNotes.value = notes

  return {
    synced: notes.length,
    notes,
  }
}

export async function ensurePublicNotesReady(username: string, options: { force?: boolean } = {}) {
  if (!username)
    return

  if (!options.force && initializedUsers.has(username))
    return

  await initializeUserPublicNotes(username)
  await syncPublicNotesForUser(username)
  initializedUsers.add(username)
}

export function markPublicNotesDirty(username: string) {
  initializedUsers.delete(username)
}
