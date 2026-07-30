import type { Note } from '@/shared/types'
import { filesApi, notesService } from '@/shared/api/pocketbase'

export type NoteWriteMode = 'auto' | 'create' | 'update'

export interface NoteRemoteUpdateResult {
  success: boolean
  fileMapping?: Map<File, string>
  record?: any
}

export interface NoteRemoteService {
  deleteNote: (noteId: string) => Promise<void>
  getFileByFilename: (noteId: string, filename: string) => Promise<{ url: string, type: string } | null>
  getNoteManifest: () => Promise<Array<{ id: string, updated: string }>>
  getNotesByUpdated: (lastUpdated: string) => Promise<Note[]>
  updateNote: (note: any, filesForUpload?: Array<File | string>, mode?: NoteWriteMode) => Promise<NoteRemoteUpdateResult>
}

function normalizeRemoteNote(note: any): Note {
  return {
    ...note,
    content: typeof note?.content === 'string'
      ? note.content.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      : '',
  }
}

export const noteRemoteService: NoteRemoteService = {
  async deleteNote(noteId: string) {
    await notesService.deleteNote(noteId)
  },
  async getFileByFilename(noteId: string, filename: string) {
    return await filesApi.getFileByFilename(noteId, filename)
  },
  async getNotesByUpdated(lastUpdated: string) {
    const result = await notesService.getNotesByUpdated(lastUpdated)

    return result.d.map(note => normalizeRemoteNote(note))
  },
  async getNoteManifest() {
    return await notesService.getNoteManifest()
  },
  async updateNote(note: any, filesForUpload?: Array<File | string>, mode: NoteWriteMode = 'auto') {
    return await notesService.updateNote(note, filesForUpload, mode)
  },
}
