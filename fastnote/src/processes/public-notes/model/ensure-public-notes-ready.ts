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
  folderId?: string
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

export async function loadPublicNote(username: string, noteId: string) {
  if (!username || !noteId) {
    return null
  }

  const userInfo = await authUsersService.getPublicUserInfo(username)
  if (!userInfo) {
    return null
  }

  return await loadPublicNoteIfNeeded(username, userInfo, noteId)
}

export async function syncPublicNotesForUser(
  username: string,
  options: Pick<EnsurePublicNotesReadyOptions, 'folderId' | 'noteId'> = {},
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

  const folderNotesPagePromise = options.folderId && options.folderId !== 'unfilednotes'
    ? publicNoteRemoteService.getPublicNotesPage(userInfo.id, options.folderId, 1)
    : null
  const [folders, unfiledNotesPage, folderNotesPage] = await Promise.all([
    publicNoteRemoteService.getPublicFolders(userInfo.id),
    publicNoteRemoteService.getPublicNotesPage(userInfo.id, 'unfilednotes', 1, 1),
    folderNotesPagePromise,
  ])
  const publicNoteStore = useUserPublicNotes(username)
  publicNoteStore.replacePublicNotes(folders)
  publicNoteStore.mergePublicNotes(unfiledNotesPage.items)
  if (folderNotesPage) {
    publicNoteStore.mergePublicNotes(folderNotesPage.items)
  }
  const targetNote = await loadPublicNoteIfNeeded(username, userInfo, options.noteId)
  const notes = publicNoteStore.publicNotes.value ?? []
  const syncedNoteIds = new Set([
    ...folders.map(note => note.id),
    ...unfiledNotesPage.items.map(note => note.id),
    ...(folderNotesPage?.items.map(note => note.id) ?? []),
    ...(targetNote ? [targetNote.id] : []),
  ])

  return {
    synced: syncedNoteIds.size,
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

  const pendingRequestKey = `${username}:${options.folderId || ''}:${options.noteId || ''}`
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
