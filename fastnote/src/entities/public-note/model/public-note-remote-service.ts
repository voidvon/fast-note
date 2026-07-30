import type { PublicNotesPage } from '@/shared/api/pocketbase'
import type { Note } from '@/shared/types'
import { notesApi } from '@/shared/api/pocketbase'

export interface PublicNoteRemoteService {
  getPublicFolders: (userId: string) => Promise<Note[]>
  getPublicNote: (userId: string, noteId: string) => Promise<Note>
  getPublicNotesPage: (userId: string, parentId: string, page?: number, perPage?: number) => Promise<PublicNotesPage>
}

export const publicNoteRemoteService: PublicNoteRemoteService = {
  async getPublicFolders(userId: string) {
    return await notesApi.getPublicFolders(userId)
  },
  async getPublicNote(userId: string, noteId: string) {
    return await notesApi.getPublicNote(userId, noteId)
  },
  async getPublicNotesPage(userId: string, parentId: string, page = 1, perPage) {
    return await notesApi.getPublicNotesPage(userId, parentId, page, perPage)
  },
}
