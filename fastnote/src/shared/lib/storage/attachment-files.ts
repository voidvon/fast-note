import type { NoteDatabase } from './dexie'
import type { NoteFileRef, NotePurgeJob } from './types'

type AttachmentDatabase = Pick<NoteDatabase, 'note_file_refs' | 'note_files' | 'note_purge_jobs'>

export async function getStoredNoteFileRef(database: AttachmentDatabase, noteId: string, remoteFilename: string) {
  return await database.note_file_refs.get([noteId, remoteFilename])
}

export async function putStoredNoteFileRef(database: AttachmentDatabase, ref: NoteFileRef) {
  await database.note_file_refs.put(ref)
}

export async function listStoredNoteFileRefs(database: AttachmentDatabase, noteId?: string) {
  return noteId
    ? await database.note_file_refs.where('noteId').equals(noteId).toArray()
    : await database.note_file_refs.toArray()
}

export async function deleteStoredNoteFileRefs(database: AttachmentDatabase, noteId: string, remoteFilenames?: string[]) {
  if (!remoteFilenames) {
    await database.note_file_refs.where('noteId').equals(noteId).delete()
    return
  }

  await database.note_file_refs.bulkDelete(remoteFilenames.map(filename => [noteId, filename]))
}

export async function putNotePurgeJob(database: AttachmentDatabase, job: NotePurgeJob) {
  await database.note_purge_jobs.put(job)
}

export async function listNotePurgeJobs(database: AttachmentDatabase) {
  return await database.note_purge_jobs.toArray()
}

export async function deleteNotePurgeJob(database: AttachmentDatabase, noteId: string) {
  await database.note_purge_jobs.delete(noteId)
}
