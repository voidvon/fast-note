import type { NoteFileRef } from '@/shared/lib/storage/types'
import type { Note } from '@/shared/types'
import { filesApi } from '@/shared/api/pocketbase/files'
import { getTime } from '@/shared/lib/date'
import { getFileHash } from '@/shared/lib/file-hash'
import {
  deleteStoredNoteFileRefs,
  getStoredNoteFileRef,
  listStoredNoteFileRefs,
  putStoredNoteFileRef,
} from '@/shared/lib/storage/attachment-files'
import { useDexie } from '@/shared/lib/storage/dexie'
import {
  deleteStoredNoteFile,
  getStoredNoteFile,
  listStoredNoteFiles,
  putStoredNoteFile,
} from '@/shared/lib/storage/note-files'
import { extractAttachmentReferences } from '../lib/attachment-references'

const activeDraftHashes = new Map<string, number>()

function requireDatabase() {
  const { db } = useDexie()
  if (!db.value)
    throw new Error('数据库未初始化')
  return db.value
}

export function registerActiveAttachmentHash(hash: string) {
  activeDraftHashes.set(hash, (activeDraftHashes.get(hash) || 0) + 1)
}

export function unregisterActiveAttachmentHashes(hashes: Iterable<string>) {
  for (const hash of hashes) {
    if ((activeDraftHashes.get(hash) || 0) <= 1) {
      activeDraftHashes.delete(hash)
    }
    else {
      activeDraftHashes.set(hash, activeDraftHashes.get(hash)! - 1)
    }
  }
}

export async function resolveStoredRemoteAttachment(noteId: string, remoteFilename: string) {
  const database = requireDatabase()
  const ref = await getStoredNoteFileRef(database, noteId, remoteFilename)
  if (!ref?.hash || ref.status !== 'ready')
    return undefined
  return await getStoredNoteFile(database, ref.hash)
}

export async function removeNoteAttachmentRefs(noteId: string) {
  await deleteStoredNoteFileRefs(requireDatabase(), noteId)
}

async function markRefFailed(ref: NoteFileRef, error: unknown) {
  const database = requireDatabase()
  const updated = getTime()
  const message = error instanceof Error ? error.message : String(error)
  const missing = /\b404\b|not found|不存在/i.test(message)
  await putStoredNoteFileRef(database, {
    ...ref,
    status: missing ? 'missing' : 'failed',
    attempts: ref.attempts + 1,
    nextRetryAt: missing ? undefined : new Date(Date.now() + Math.min(300000, 1000 * 2 ** ref.attempts)).toISOString(),
    lastError: message,
    updated,
  })
}

export async function hydrateRemoteAttachment(noteId: string, remoteFilename: string) {
  const database = requireDatabase()
  const now = getTime()
  const existingRef = await getStoredNoteFileRef(database, noteId, remoteFilename)
  const ref: NoteFileRef = existingRef || {
    noteId,
    remoteFilename,
    status: 'pending_download',
    attempts: 0,
    created: now,
    updated: now,
  }

  if (ref.status === 'ready' && ref.hash && await getStoredNoteFile(database, ref.hash))
    return ref

  if (ref.nextRetryAt && new Date(ref.nextRetryAt).getTime() > Date.now())
    throw new Error(ref.lastError || `附件等待重试: ${remoteFilename}`)

  await putStoredNoteFileRef(database, { ...ref, status: 'downloading', updated: now })

  try {
    const file = await filesApi.downloadNoteFile(noteId, remoteFilename)
    const hash = await getFileHash(file)
    const stored = await getStoredNoteFile(database, hash)
    const downloadedAt = getTime()

    if (!stored) {
      await putStoredNoteFile(database, {
        hash,
        file,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        created: downloadedAt,
        updated: downloadedAt,
        lastReferencedAt: downloadedAt,
        downloadedAt,
      })
    }

    const readyRef: NoteFileRef = {
      ...ref,
      hash,
      status: 'ready',
      attempts: ref.attempts,
      nextRetryAt: undefined,
      lastError: undefined,
      updated: downloadedAt,
    }
    await putStoredNoteFileRef(database, readyRef)
    return readyRef
  }
  catch (error) {
    await markRefFailed(ref, error)
    throw error
  }
}

export async function reconcileRemoteNoteAttachments(note: Note) {
  const database = requireDatabase()
  const { remoteFilenames } = extractAttachmentReferences(note.content)
  const liveRemoteNames = new Set(remoteFilenames)
  const staleRefs = (await listStoredNoteFileRefs(database, note.id))
    .filter(ref => !liveRemoteNames.has(ref.remoteFilename))

  if (staleRefs.length > 0)
    await deleteStoredNoteFileRefs(database, note.id, staleRefs.map(ref => ref.remoteFilename))

  const results: PromiseSettledResult<NoteFileRef>[] = []
  const queue = [...remoteFilenames]
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length > 0) {
      const filename = queue.shift()!
      try {
        results.push({ status: 'fulfilled', value: await hydrateRemoteAttachment(note.id, filename) })
      }
      catch (reason) {
        results.push({ status: 'rejected', reason })
      }
    }
  })
  await Promise.all(workers)
  return {
    ready: results.filter(result => result.status === 'fulfilled').length,
    failed: results.filter(result => result.status === 'rejected').length,
    total: results.length,
  }
}

export async function getAttachmentHydrationStatus() {
  const refs = await listStoredNoteFileRefs(requireDatabase())
  const ready = refs.filter(ref => ref.status === 'ready').length
  const failed = refs.filter(ref => ref.status === 'failed').length
  const missing = refs.filter(ref => ref.status === 'missing').length
  const pending = refs.length - ready - failed - missing
  return {
    total: refs.length,
    ready,
    failed,
    missing,
    pending,
    hydrated: failed === 0 && missing === 0 && pending === 0,
    quotaExceeded: refs.some(ref => /quota|空间|storage/i.test(ref.lastError || '')),
  }
}

export async function garbageCollectAttachments(notes: Note[]) {
  const database = requireDatabase()
  const liveHashes = new Set(activeDraftHashes.keys())
  for (const note of notes) {
    extractAttachmentReferences(note.content).hashes.forEach(hash => liveHashes.add(hash))
  }
  for (const ref of await listStoredNoteFileRefs(database)) {
    if (ref.hash)
      liveHashes.add(ref.hash)
  }

  const stale = (await listStoredNoteFiles(database)).filter(file => !liveHashes.has(file.hash))
  for (const file of stale)
    await deleteStoredNoteFile(database, file.hash)
  return stale.length
}
