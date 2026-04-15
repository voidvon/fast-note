import { notesApi } from '@/shared/api/pocketbase'

export interface PublicNoteRemoteService {
  getPublicNotes: (userId: string) => Promise<any[]>
}

export const publicNoteRemoteService: PublicNoteRemoteService = {
  async getPublicNotes(userId: string) {
    return await notesApi.getPublicNotes(userId)
  },
}
