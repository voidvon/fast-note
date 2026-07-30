import { garbageCollectAttachments } from '@/entities/attachment'
import { hasRemoteUserId, noteRemoteService, useNote } from '@/entities/note'
import { listNotePurgeJobs, useDexie } from '@/shared/lib/storage'

export function useSyncManifestService() {
  const { deleteNote, notes } = useNote()

  async function reconcileRemoteNoteManifest() {
    const { db } = useDexie()
    if (!db.value)
      throw new Error('数据库未初始化')

    const manifest = await noteRemoteService.getNoteManifest()
    const remoteIds = new Set(manifest.map(item => item.id))
    const purgeIds = new Set((await listNotePurgeJobs(db.value)).map(job => job.noteId))
    const missingLocalNotes = notes.value.filter(note => (
      hasRemoteUserId(note)
      && !remoteIds.has(note.id)
      && !purgeIds.has(note.id)
    ))

    for (const note of missingLocalNotes) {
      await db.value.transaction('rw', db.value.notes, db.value.note_file_refs, () => Promise.all([
        db.value!.notes.delete(note.id),
        db.value!.note_file_refs.where('noteId').equals(note.id).delete(),
      ]))
      deleteNote(note.id)
    }

    await garbageCollectAttachments(notes.value)
    return { remoteCount: manifest.length, removedLocalCount: missingLocalNotes.length }
  }

  return { reconcileRemoteNoteManifest }
}
