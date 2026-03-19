import type { PublicUserInfo } from '@/shared/types/pocketbase'
import { initializeUserPublicNotes, publicNoteRemoteService, useUserPublicNotes } from '@/entities/public-note'
import { usePublicUserCache } from './use-public-user-cache'

const initializedUsers = new Set<string>()
const pendingReadyRequests = new Map<string, Promise<PublicNotesReadyResult>>()

export interface PublicNotesReadyResult {
  notes: ReturnType<typeof useUserPublicNotes>['publicNotes']['value']
  synced: number
  userInfo: PublicUserInfo | null
}

export async function syncPublicNotesForUser(username: string) {
  if (!username)
    return { synced: 0, notes: [], userInfo: null }

  const { getPublicUserInfo } = usePublicUserCache()
  const userInfo = await getPublicUserInfo(username)

  if (!userInfo) {
    return {
      synced: 0,
      notes: [],
      userInfo: null,
    }
  }

  const notes = await publicNoteRemoteService.getPublicNotes(userInfo.id)
  const { publicNotes } = useUserPublicNotes(username)
  publicNotes.value = notes

  return {
    synced: notes.length,
    notes,
    userInfo,
  }
}

export async function ensurePublicNotesReady(username: string, options: { force?: boolean } = {}) {
  if (!username) {
    return {
      synced: 0,
      notes: [],
      userInfo: null,
    }
  }

  if (!options.force && initializedUsers.has(username)) {
    const { publicNotes } = useUserPublicNotes(username)
    const { getPublicUserInfo } = usePublicUserCache()
    const cachedNotes = publicNotes.value ?? []

    return {
      synced: cachedNotes.length,
      notes: cachedNotes,
      userInfo: await getPublicUserInfo(username),
    }
  }

  const pendingRequestKey = `${username}:${options.force ? 'force' : 'default'}`
  const existingPendingRequest = pendingReadyRequests.get(pendingRequestKey)
  if (existingPendingRequest) {
    return await existingPendingRequest
  }

  const readyPromise = (async () => {
    await initializeUserPublicNotes(username)
    const result = await syncPublicNotesForUser(username)
    initializedUsers.add(username)
    return result
  })()

  pendingReadyRequests.set(pendingRequestKey, readyPromise)

  try {
    return await readyPromise
  }
  finally {
    pendingReadyRequests.delete(pendingRequestKey)
  }
}

export function markPublicNotesDirty(username: string) {
  initializedUsers.delete(username)
}
