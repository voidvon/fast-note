import type { Note, NotePurgeJob } from '@/shared/lib/storage'
import Dexie from 'dexie'
import { getTime } from '@/shared/lib/date'
import {
  deleteNotePurgeJob,
  listNotePurgeJobs,
  openCurrentDatabaseConnection,
  putNotePurgeJob,
  useDexie,
} from '@/shared/lib/storage'
import { hasRemoteUserId, NOTE_DELETION_RETENTION_DAYS } from './domain/note-rules'
import { noteRemoteService } from './note-remote-service'
import { useNote } from './state/note-store'

function requireDatabase() {
  const { db } = useDexie()
  if (!db.value)
    throw new Error('数据库未初始化')
  return db.value
}

async function nextMacrotask() {
  await new Promise(resolve => setTimeout(resolve, 0))
}

async function withFreshDatabase<T>(operation: (database: ReturnType<typeof requireDatabase>) => Promise<T>) {
  const database = await openCurrentDatabaseConnection()
  try {
    return await operation(database)
  }
  finally {
    database.close()
  }
}

async function deleteLocalPurgedNote(database: ReturnType<typeof requireDatabase>, noteId: string) {
  try {
    await Dexie.ignoreTransaction(() => database.transaction('rw', database.notes, database.note_file_refs, database.note_purge_jobs, () => Promise.all([
      database.notes.delete(noteId),
      database.note_file_refs.where('noteId').equals(noteId).delete(),
      database.note_purge_jobs.delete(noteId),
    ])))
  }
  catch (error) {
    console.warn('当前数据库连接清理永久删除笔记失败，尝试使用新连接重试:', error)
    await withFreshDatabase(freshDatabase => freshDatabase.transaction('rw', freshDatabase.notes, freshDatabase.note_file_refs, freshDatabase.note_purge_jobs, () => Promise.all([
      freshDatabase.notes.delete(noteId),
      freshDatabase.note_file_refs.where('noteId').equals(noteId).delete(),
      freshDatabase.note_purge_jobs.delete(noteId),
    ])))
  }
}

export function useNotePurgeService() {
  const { deleteNote, getNote, notes, updateNote } = useNote()

  async function queueNotePurge(noteId: string) {
    await nextMacrotask()
    const database = requireDatabase()
    const existing = await Dexie.ignoreTransaction(() => database.note_purge_jobs.get(noteId))
    const now = getTime()
    const job: NotePurgeJob = existing || {
      noteId,
      status: 'pending',
      attempts: 0,
      created: now,
      updated: now,
    }
    const queuedJob: NotePurgeJob = { ...job, status: 'pending', updated: now }
    const hiddenUpdated = new Date(0).toISOString().replace('T', ' ')
    await Dexie.ignoreTransaction(() => database.note_purge_jobs.put(queuedJob))

    try {
      await Dexie.ignoreTransaction(() => database.notes.update(noteId, { updated: hiddenUpdated }))
    }
    catch (error) {
      console.warn('标记待永久删除笔记失败，尝试使用新连接重试:', error)
      try {
        await withFreshDatabase(freshDatabase => freshDatabase.notes.update(noteId, { updated: hiddenUpdated }))
      }
      catch (retryError) {
        console.warn('标记待永久删除笔记失败，已保留 purge job 作为删除任务来源:', retryError)
      }
    }

    if (getNote(noteId))
      updateNote(noteId, { updated: hiddenUpdated })
    return queuedJob
  }

  async function purgeNoteNow(note: Note) {
    const database = requireDatabase()
    const queued = await queueNotePurge(note.id)
    const running: NotePurgeJob = {
      ...queued,
      status: 'running',
      updated: getTime(),
    }
    await Dexie.ignoreTransaction(() => putNotePurgeJob(database, running))

    try {
      if (hasRemoteUserId(note))
        await noteRemoteService.deleteNote(note.id)

      await deleteLocalPurgedNote(database, note.id)
      deleteNote(note.id)
    }
    catch (error) {
      await Dexie.ignoreTransaction(() => putNotePurgeJob(database, {
        ...running,
        status: 'failed',
        attempts: running.attempts + 1,
        nextRetryAt: new Date(Date.now() + Math.min(300000, 1000 * 2 ** running.attempts)).toISOString(),
        lastError: error instanceof Error ? error.message : String(error),
        updated: getTime(),
      }))
      throw error
    }
  }

  async function runPendingNotePurges() {
    const jobs = await listNotePurgeJobs(requireDatabase())
    let completed = 0
    for (const job of jobs) {
      if (job.nextRetryAt && new Date(job.nextRetryAt).getTime() > Date.now())
        continue
      const note = getNote(job.noteId) || await requireDatabase().notes.get(job.noteId)
      if (!note) {
        await deleteNotePurgeJob(requireDatabase(), job.noteId)
        continue
      }
      await purgeNoteNow(note)
      completed++
    }
    return completed
  }

  async function queueExpiredNotePurges(now = Date.now()) {
    const retentionMs = NOTE_DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000
    const queuedIds = new Set((await listNotePurgeJobs(requireDatabase())).map(job => job.noteId))
    const expired = notes.value.filter(note => (
      note.is_deleted === 1
      && !queuedIds.has(note.id)
      && now - new Date(note.updated).getTime() > retentionMs
    ))
    for (const note of expired)
      await queueNotePurge(note.id)
    return expired.length
  }

  return { purgeNoteNow, queueExpiredNotePurges, queueNotePurge, runPendingNotePurges }
}
