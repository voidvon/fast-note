import type { NoteSyncOperation } from './note-sync-plan-service'
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
  const { getNote, addNote, deleteNote, updateNote } = useNote()
  const { syncDeletedNoteToRemote, syncNoteToRemote } = useNoteSyncService()

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
          uploadedCount++
        }
        else if (action === 'update') {
          syncedUpdatedAt = (await syncNoteToRemote(note, 'update')).syncedUpdatedAt
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
