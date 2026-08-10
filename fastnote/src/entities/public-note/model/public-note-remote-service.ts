import type { PublicNotesPage } from '@/shared/api/pocketbase'
import type { Note } from '@/shared/types'
import { notesApi, PUBLIC_NOTES_PAGE_SIZE } from '@/shared/api/pocketbase'

export interface PublicNoteRemoteService {
  getPublicFolders: (userId: string) => Promise<Note[]>
  getPublicNote: (userId: string, noteId: string) => Promise<Note>
  getPublicNotesPage: (userId: string, parentId: string, page?: number, perPage?: number) => Promise<PublicNotesPage>
}

const pendingPublicNoteRequests = new Map<string, Promise<unknown>>()

async function reusePendingRequest<T>(key: string, requestFactory: () => Promise<T>): Promise<T> {
  const pendingRequest = pendingPublicNoteRequests.get(key) as Promise<T> | undefined
  if (pendingRequest) {
    return await pendingRequest
  }

  const request = requestFactory()
  pendingPublicNoteRequests.set(key, request)

  try {
    return await request
  }
  finally {
    if (pendingPublicNoteRequests.get(key) === request) {
      pendingPublicNoteRequests.delete(key)
    }
  }
}

export const publicNoteRemoteService: PublicNoteRemoteService = {
  async getPublicFolders(userId: string) {
    return await reusePendingRequest(
      `folders:${userId}`,
      () => notesApi.getPublicFolders(userId),
    )
  },
  async getPublicNote(userId: string, noteId: string) {
    return await reusePendingRequest(
      `note:${userId}:${noteId}`,
      () => notesApi.getPublicNote(userId, noteId),
    )
  },
  async getPublicNotesPage(userId: string, parentId: string, page = 1, perPage) {
    const resolvedPerPage = perPage ?? PUBLIC_NOTES_PAGE_SIZE
    return await reusePendingRequest(
      `notes:${userId}:${parentId}:${page}:${resolvedPerPage}`,
      () => notesApi.getPublicNotesPage(userId, parentId, page, resolvedPerPage),
    )
  },
}
