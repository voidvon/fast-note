import type { Note } from '@/shared/types'
import { hasRemoteUserId, NOTE_DELETION_RETENTION_DAYS } from './domain/note-rules'

export type NoteSyncAction = 'upload' | 'update' | 'download' | 'delete' | 'deleteLocal' | 'skip'

export interface NoteSyncOperation {
  note: Note
  action: NoteSyncAction
}

export interface BuildNoteSyncOperationsParams {
  localNotes: Note[]
  cloudNotes: Note[]
  now?: number
}

function toUpdatedTimestamp(updatedAt: string) {
  return new Date(updatedAt).getTime()
}

export function buildNoteSyncOperations({
  localNotes,
  cloudNotes,
  now = Date.now(),
}: BuildNoteSyncOperationsParams): NoteSyncOperation[] {
  const operations: NoteSyncOperation[] = []
  const localNotesMap = new Map(localNotes.map(note => [note.id, note]))
  const cloudNotesMap = new Map(cloudNotes.map(note => [note.id, note]))
  const deletionRetentionMs = NOTE_DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000

  for (const note of localNotes) {
    const cloudNote = cloudNotesMap.get(note.id)
    const isSyncedNote = hasRemoteUserId(note)
    const localTime = toUpdatedTimestamp(note.updated)
    const cloudTime = cloudNote ? toUpdatedTimestamp(cloudNote.updated) : null

    if (note.is_deleted === 1) {
      if (now - localTime > deletionRetentionMs) {
        operations.push({ note, action: 'deleteLocal' })

        if (isSyncedNote) {
          operations.push({ note: { ...note }, action: 'delete' })
        }

        continue
      }

      if (!isSyncedNote) {
        operations.push({ note, action: 'skip' })
        continue
      }

      if (!cloudNote || cloudTime === null || localTime > cloudTime) {
        operations.push({ note: { ...note }, action: 'delete' })
      }
      else if (localTime < cloudTime) {
        operations.push({ note: cloudNote, action: 'download' })
      }

      continue
    }

    if (!isSyncedNote) {
      operations.push({ note, action: 'upload' })
      continue
    }

    if (!cloudNote) {
      operations.push({ note, action: 'update' })
      continue
    }

    const remoteUpdatedTime = toUpdatedTimestamp(cloudNote.updated)

    if (localTime > remoteUpdatedTime) {
      operations.push({ note: { ...note }, action: 'update' })
    }
    else if (localTime < remoteUpdatedTime) {
      operations.push({ note: cloudNote, action: 'download' })
    }
  }

  for (const note of cloudNotes) {
    const localNote = localNotesMap.get(note.id)
    const cloudTime = toUpdatedTimestamp(note.updated)

    if (note.is_deleted === 1) {
      if (now - cloudTime > deletionRetentionMs) {
        if (localNote) {
          operations.push({ note, action: 'deleteLocal' })
        }

        continue
      }

      if (!localNote) {
        operations.push({ note, action: 'download' })
        continue
      }

      const localTime = toUpdatedTimestamp(localNote.updated)

      if (cloudTime > localTime) {
        operations.push({ note, action: 'download' })
      }

      continue
    }

    if (!localNote) {
      operations.push({ note, action: 'download' })
      continue
    }

    const localTime = toUpdatedTimestamp(localNote.updated)

    if (cloudTime > localTime) {
      operations.push({ note, action: 'download' })
    }
  }

  operations.sort((a, b) => toUpdatedTimestamp(a.note.updated) - toUpdatedTimestamp(b.note.updated))

  return operations
}
