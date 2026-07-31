import type { NoteFile, NoteFileRef } from '@/shared/lib/storage/types'
import type { Note } from '@/shared/types'
import { filesApi } from '@/shared/api/pocketbase/files'
import { getTime } from '@/shared/lib/date'
import { getFileHash } from '@/shared/lib/file-hash'
import { getMimeTypeByFilename } from '@/shared/lib/mime-types'
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
const inflightHydrations = new Map<string, Promise<NoteFileRef>>()
const pendingHydrations: Array<() => void> = []
const MAX_CONCURRENT_HYDRATIONS = 3
let activeHydrations = 0

export interface UploadedAttachmentMapping {
  file: NoteFile
  remoteFilename: string
}

async function withHydrationSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeHydrations >= MAX_CONCURRENT_HYDRATIONS) {
    await new Promise<void>((resolve) => {
      pendingHydrations.push(resolve)
    })
  }
  else {
    activeHydrations++
  }

  try {
    return await task()
  }
  finally {
    const next = pendingHydrations.shift()
    if (next)
      next()
    else
      activeHydrations--
  }
}

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

async function performRemoteAttachmentHydration(
  noteId: string,
  remoteFilename: string,
  options: { force?: boolean },
) {
  const database = requireDatabase()
  const now = getTime()
  const existingRef = await getStoredNoteFileRef(database, noteId, remoteFilename)
  const ref: NoteFileRef = existingRef || {
    noteId,
    remoteFilename,
    fileName: remoteFilename,
    fileType: getMimeTypeByFilename(remoteFilename),
    status: 'remote_only',
    attempts: 0,
    created: now,
    updated: now,
  }

  if (ref.status === 'ready' && ref.hash && await getStoredNoteFile(database, ref.hash))
    return ref

  if (!options.force && ref.nextRetryAt && new Date(ref.nextRetryAt).getTime() > Date.now())
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
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
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

export async function hydrateRemoteAttachment(
  noteId: string,
  remoteFilename: string,
  options: { force?: boolean } = {},
) {
  const key = `${noteId}:${remoteFilename}`
  const inflight = inflightHydrations.get(key)
  if (inflight)
    return await inflight

  const hydration = withHydrationSlot(() => performRemoteAttachmentHydration(noteId, remoteFilename, options))
  inflightHydrations.set(key, hydration)

  try {
    return await hydration
  }
  finally {
    if (inflightHydrations.get(key) === hydration)
      inflightHydrations.delete(key)
  }
}

export async function registerCachedRemoteAttachment(noteId: string, remoteFilename: string, hash: string) {
  const database = requireDatabase()
  const storedFile = await getStoredNoteFile(database, hash)
  if (!storedFile)
    throw new Error(`本地附件不存在，无法登记远程引用: ${hash}`)

  const existingRef = await getStoredNoteFileRef(database, noteId, remoteFilename)
  const now = getTime()
  const ref: NoteFileRef = {
    noteId,
    remoteFilename,
    hash,
    fileName: storedFile.fileName,
    fileSize: storedFile.fileSize,
    fileType: storedFile.fileType,
    status: 'ready',
    attempts: existingRef?.attempts || 0,
    created: existingRef?.created || now,
    updated: now,
  }
  await putStoredNoteFileRef(database, ref)
  return ref
}

export async function commitUploadedNoteAttachments(note: Note, mappings: UploadedAttachmentMapping[]) {
  const database = requireDatabase()
  const now = getTime()

  await database.transaction('rw', database.notes, database.note_file_refs, async () => {
    const refs = await Promise.all(mappings.map(async ({ file, remoteFilename }) => {
      const existing = await database.note_file_refs.get([note.id, remoteFilename])
      return {
        noteId: note.id,
        remoteFilename,
        hash: file.hash,
        fileName: file.fileName,
        fileSize: file.fileSize,
        fileType: file.fileType,
        status: 'ready' as const,
        attempts: existing?.attempts || 0,
        created: existing?.created || now,
        updated: now,
      }
    }))

    await Promise.all([
      database.notes.put(note),
      database.note_file_refs.bulkPut(refs),
    ])
  })
}

export async function reconcileRemoteNoteAttachmentRefs(note: Note) {
  const database = requireDatabase()
  const { remoteFilenames } = extractAttachmentReferences(note.content)
  const liveRemoteNames = new Set(remoteFilenames)
  const staleRefs = (await listStoredNoteFileRefs(database, note.id))
    .filter(ref => !liveRemoteNames.has(ref.remoteFilename))

  if (staleRefs.length > 0)
    await deleteStoredNoteFileRefs(database, note.id, staleRefs.map(ref => ref.remoteFilename))

  let ready = 0
  let remoteOnly = 0

  for (const remoteFilename of remoteFilenames) {
    const existingRef = await getStoredNoteFileRef(database, note.id, remoteFilename)
    const cached = existingRef?.hash
      ? await getStoredNoteFile(database, existingRef.hash)
      : undefined

    if (cached) {
      ready++
      if (existingRef?.status !== 'ready')
        await registerCachedRemoteAttachment(note.id, remoteFilename, existingRef!.hash!)
      continue
    }

    remoteOnly++
    const now = getTime()
    const status = existingRef?.status === 'failed' || existingRef?.status === 'missing'
      ? existingRef.status
      : 'remote_only'
    await putStoredNoteFileRef(database, {
      noteId: note.id,
      remoteFilename,
      fileName: existingRef?.fileName || remoteFilename,
      fileSize: existingRef?.fileSize,
      fileType: existingRef?.fileType || getMimeTypeByFilename(remoteFilename),
      status,
      attempts: existingRef?.attempts || 0,
      nextRetryAt: existingRef?.nextRetryAt,
      lastError: existingRef?.lastError,
      created: existingRef?.created || now,
      updated: now,
    })
  }

  return {
    ready,
    remoteOnly,
    total: remoteFilenames.length,
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
