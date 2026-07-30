import type { NoteSyncOperation } from './note-sync-plan-service'
import { garbageCollectAttachments, reconcileRemoteNoteAttachments } from '@/entities/attachment'
import { useNotePurgeService } from './note-purge-service'
import { useNoteSyncService } from './note-sync-service'
import { useNote } from './state/note-store'

export interface NoteSyncExecutionResult {
  uploaded: number
  downloaded: number
  deleted: number
}

export interface ExecuteNoteSyncOperationsParams {
  operations: NoteSyncOperation[]
  onOperationSynced?: (payload: {
    operation: NoteSyncOperation
    syncedUpdatedAt: string
  }) => void | Promise<void>
}

export function useNoteSyncExecutorService() {
  const { getNote, addNote, deleteNote, notes, updateNote } = useNote()
  const { syncDeletedNoteToRemote, syncNoteToRemote } = useNoteSyncService()
  const { purgeNoteNow } = useNotePurgeService()

  async function executeNoteSyncOperations({
    operations,
    onOperationSynced,
  }: ExecuteNoteSyncOperationsParams): Promise<NoteSyncExecutionResult> {
    let uploadedCount = 0
    let downloadedCount = 0
    let deletedCount = 0

    for (const operation of operations) {
      const { note, action } = operation

      try {
        let syncedUpdatedAt = note.updated

        if (action === 'upload') {
          syncedUpdatedAt = (await syncNoteToRemote(note, 'create')).syncedUpdatedAt
          const syncedNote = await getNote(note.id)
          if (syncedNote)
            await reconcileRemoteNoteAttachments(syncedNote)
          uploadedCount++
        }
        else if (action === 'update') {
          syncedUpdatedAt = (await syncNoteToRemote(note, 'update')).syncedUpdatedAt
          const syncedNote = await getNote(note.id)
          if (syncedNote)
            await reconcileRemoteNoteAttachments(syncedNote)
          uploadedCount++
        }
        else if (action === 'download') {
          const localNote = await getNote(note.id)

          if (localNote) {
            await updateNote(note.id, note)
          }
          else {
            await addNote(note)
          }

          await reconcileRemoteNoteAttachments(note)

          downloadedCount++
        }
        else if (action === 'deleteLocal') {
          await deleteNote(note.id)
          deletedCount++
        }
        else if (action === 'delete') {
          syncedUpdatedAt = (await syncDeletedNoteToRemote(note)).syncedUpdatedAt
          deletedCount++
        }
        else if (action === 'purge') {
          await purgeNoteNow(note)
          deletedCount++
        }

        await onOperationSynced?.({
          operation,
          syncedUpdatedAt,
        })
      }
      catch (error) {
        console.error(`PocketBase同步操作失败 (${action}):`, error)
        throw error
      }
    }

    await garbageCollectAttachments(notes.value)

    return {
      uploaded: uploadedCount,
      downloaded: downloadedCount,
      deleted: deletedCount,
    }
  }

  return {
    executeNoteSyncOperations,
  }
}
