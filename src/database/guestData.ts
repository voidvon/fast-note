import type { Metadata, NoteFile, UserInfo } from './types'
import type { Note } from '@/types'
import { GUEST_SCOPE_ID } from '@/utils/userScope'
import { openIsolatedDatabase, useDexie } from './dexie'
import { logger } from '@/utils/logger'

export type GuestDataDecision = 'merge' | 'coexist'

export interface GuestDataStats {
  notes: number
  noteFiles: number
}

interface GuestDataset {
  notes: Note[]
  noteFiles: NoteFile[]
  metadata: Metadata[]
  userInfo: UserInfo[]
}

function compareUpdated(left?: string, right?: string) {
  if (!left && !right)
    return 0
  if (!left)
    return -1
  if (!right)
    return 1
  if (left === right)
    return 0
  return left > right ? 1 : -1
}

async function readGuestDataset() {
  const guestDb = await openIsolatedDatabase(GUEST_SCOPE_ID)

  try {
    const [notes, noteFiles, metadata, userInfo] = await Promise.all([
      guestDb.notes.toArray(),
      guestDb.note_files.toArray(),
      guestDb.metadata.toArray(),
      guestDb.user_info.toArray(),
    ])

    return {
      notes,
      noteFiles,
      metadata,
      userInfo,
    } satisfies GuestDataset
  }
  finally {
    guestDb.close()
  }
}

async function clearGuestDataset() {
  const guestDb = await openIsolatedDatabase(GUEST_SCOPE_ID)

  try {
    await guestDb.transaction('rw', guestDb.notes, guestDb.note_files, guestDb.metadata, guestDb.user_info, async () => {
      await guestDb.notes.clear()
      await guestDb.note_files.clear()
      await guestDb.metadata.clear()
      await guestDb.user_info.clear()
    })
  }
  finally {
    guestDb.close()
  }
}

export async function getGuestDataStats(): Promise<GuestDataStats> {
  const guestDb = await openIsolatedDatabase(GUEST_SCOPE_ID)

  try {
    const [notes, noteFiles] = await Promise.all([
      guestDb.notes.count(),
      guestDb.note_files.count(),
    ])

    return { notes, noteFiles }
  }
  finally {
    guestDb.close()
  }
}

export async function hasGuestData(): Promise<boolean> {
  const stats = await getGuestDataStats()
  return stats.notes > 0 || stats.noteFiles > 0
}

export async function mergeGuestDataIntoCurrent() {
  const { db } = useDexie()
  if (!db.value) {
    throw new Error('数据库未初始化')
  }

  const guestData = await readGuestDataset()

  if (guestData.notes.length === 0 && guestData.noteFiles.length === 0) {
    return { notesUpserted: 0, noteFilesUpserted: 0 }
  }

  const [currentNotes, currentNoteFiles] = await Promise.all([
    db.value.notes.toArray(),
    db.value.note_files.toArray(),
  ])

  const currentNoteMap = new Map(currentNotes.map(note => [note.id, note]))
  const currentNoteFileMap = new Map(currentNoteFiles.map(file => [file.hash, file]))

  const notesToUpsert: Note[] = []
  const noteFilesToUpsert: NoteFile[] = []

  for (const guestNote of guestData.notes) {
    const existing = currentNoteMap.get(guestNote.id)
    if (!existing) {
      notesToUpsert.push(guestNote)
      continue
    }

    if (compareUpdated(guestNote.updated, existing.updated) > 0) {
      notesToUpsert.push(guestNote)
    }
  }

  for (const guestFile of guestData.noteFiles) {
    const existing = currentNoteFileMap.get(guestFile.hash)
    if (!existing) {
      noteFilesToUpsert.push(guestFile)
      continue
    }

    if (compareUpdated(guestFile.updated, existing.updated) > 0) {
      noteFilesToUpsert.push(guestFile)
    }
  }

  await db.value.transaction('rw', db.value.notes, db.value.note_files, async () => {
    if (notesToUpsert.length > 0) {
      await db.value.notes.bulkPut(notesToUpsert)
    }
    if (noteFilesToUpsert.length > 0) {
      await db.value.note_files.bulkPut(noteFilesToUpsert)
    }
  })

  await clearGuestDataset()

  logger.info('游客态数据合并完成', {
    notesUpserted: notesToUpsert.length,
    noteFilesUpserted: noteFilesToUpsert.length,
  })

  return {
    notesUpserted: notesToUpsert.length,
    noteFilesUpserted: noteFilesToUpsert.length,
  }
}
