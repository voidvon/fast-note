import type { PublicUserInfo } from '@/shared/types/pocketbase'
import { authUsersService } from '@/entities/auth'
import { publicNoteRemoteService, useUserPublicNotes } from '@/entities/public-note'

const pendingReadyRequests = new Map<string, Promise<PublicNotesReadyResult>>()

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

  const note = await publicNoteRemoteService.getPublicNote(userInfo.id, noteId)
  useUserPublicNotes(username).mergePublicNotes([note])
  return note
}

export async function syncPublicNotesForUser(
  username: string,
  options: Pick<EnsurePublicNotesReadyOptions, 'noteId'> = {},
) {
  if (!username)
    return { synced: 0, notes: [], unfiledNotesCount: 0, userInfo: null }

  const userInfo = await authUsersService.getPublicUserInfo(username)

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

  const pendingRequestKey = `${username}:${options.noteId || ''}`
  const existingPendingRequest = pendingReadyRequests.get(pendingRequestKey)
  if (existingPendingRequest) {
    return await existingPendingRequest
  }

  const readyPromise = (async () => {
    return await syncPublicNotesForUser(username, options)
  })()

  pendingReadyRequests.set(pendingRequestKey, readyPromise)

  try {
    return await readyPromise
  }
  finally {
    pendingReadyRequests.delete(pendingRequestKey)
  }
}
