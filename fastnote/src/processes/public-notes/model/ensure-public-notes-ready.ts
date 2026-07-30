import type { PublicUserInfo } from '@/shared/types/pocketbase'
import { initializeUserPublicNotes, publicNoteRemoteService, useUserPublicNotes } from '@/entities/public-note'
import { usePublicUserCache } from './use-public-user-cache'

const initializedUsers = new Set<string>()
const pendingReadyRequests = new Map<string, Promise<PublicNotesReadyResult>>()
const unfiledNoteTotals = new Map<string, number>()

export interface PublicNotesReadyResult {
  notes: ReturnType<typeof useUserPublicNotes>['publicNotes']['value']
  synced: number
  unfiledNotesCount: number
  userInfo: PublicUserInfo | null
}

export interface EnsurePublicNotesReadyOptions {
  force?: boolean
  noteId?: string
}

async function loadPublicNoteIfNeeded(
  username: string,
  userInfo: PublicUserInfo,
  noteId?: string,
) {
  if (!noteId) {
    return null
  }

  const publicNoteStore = useUserPublicNotes(username)
  const cachedNote = publicNoteStore.getPublicNote(noteId)
  if (cachedNote?.content !== undefined) {
    return cachedNote
  }

  const note = await publicNoteRemoteService.getPublicNote(userInfo.id, noteId)
  publicNoteStore.mergePublicNotes([note])
  return note
}

export async function syncPublicNotesForUser(
  username: string,
  options: Pick<EnsurePublicNotesReadyOptions, 'noteId'> = {},
) {
  if (!username)
    return { synced: 0, notes: [], unfiledNotesCount: 0, userInfo: null }

  const { getPublicUserInfo } = usePublicUserCache()
  const userInfo = await getPublicUserInfo(username)

  if (!userInfo) {
    return {
      synced: 0,
      notes: [],
      unfiledNotesCount: 0,
      userInfo: null,
    }
  }

  const [folders, unfiledNotesPage] = await Promise.all([
    publicNoteRemoteService.getPublicFolders(userInfo.id),
    publicNoteRemoteService.getPublicNotesPage(userInfo.id, 'unfilednotes', 1, 1),
  ])
  const publicNoteStore = useUserPublicNotes(username)
  publicNoteStore.replacePublicNotes(folders)
  publicNoteStore.mergePublicNotes(unfiledNotesPage.items)
  unfiledNoteTotals.set(username, unfiledNotesPage.totalItems)
  const targetNote = await loadPublicNoteIfNeeded(username, userInfo, options.noteId)
  const notes = publicNoteStore.publicNotes.value ?? []
  const previewNoteIds = new Set(unfiledNotesPage.items.map(note => note.id))

  return {
    synced: folders.length + unfiledNotesPage.items.length + (targetNote && !previewNoteIds.has(targetNote.id) ? 1 : 0),
    notes,
    unfiledNotesCount: unfiledNotesPage.totalItems,
    userInfo,
  }
}

export async function ensurePublicNotesReady(username: string, options: EnsurePublicNotesReadyOptions = {}) {
  if (!username) {
    return {
      synced: 0,
      notes: [],
      unfiledNotesCount: 0,
      userInfo: null,
    }
  }

  if (!options.force && initializedUsers.has(username)) {
    const publicNoteStore = useUserPublicNotes(username)
    const { getPublicUserInfo } = usePublicUserCache()
    const userInfo = await getPublicUserInfo(username)
    if (userInfo) {
      await loadPublicNoteIfNeeded(username, userInfo, options.noteId)
    }
    const cachedNotes = publicNoteStore.publicNotes.value ?? []

    return {
      synced: cachedNotes.length,
      notes: cachedNotes,
      unfiledNotesCount: unfiledNoteTotals.get(username) || 0,
      userInfo,
    }
  }

  const pendingRequestKey = `${username}:${options.force ? 'force' : 'default'}`
  const existingPendingRequest = pendingReadyRequests.get(pendingRequestKey)
  if (existingPendingRequest) {
    return await existingPendingRequest
  }

  const readyPromise = (async () => {
    await initializeUserPublicNotes(username)
    const result = await syncPublicNotesForUser(username, options)
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
  unfiledNoteTotals.delete(username)
}
