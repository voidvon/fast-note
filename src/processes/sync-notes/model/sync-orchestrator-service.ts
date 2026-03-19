import { buildNoteSyncOperations, noteRemoteService, useNote, useNoteSyncExecutorService } from '@/entities/note'
import { useSyncRuntimeState, writeSyncCursor } from './sync-runtime-state'

export function useSyncOrchestratorService() {
  const { getNotesByUpdated } = useNote()
  const { executeNoteSyncOperations } = useNoteSyncExecutorService()
  const { ensureSyncScopeReady, updated } = useSyncRuntimeState()

  async function runIncrementalNoteSync() {
    const currentUserId = ensureSyncScopeReady()

    console.warn('PocketBase同步开始，updated:', updated.value)

    const localNotes = await getNotesByUpdated(updated.value)
    console.warn('本地笔记变更:', localNotes)

    const cloudNotes = await noteRemoteService.getNotesByUpdated(updated.value)
    console.warn('云端笔记变更:', cloudNotes)

    const operations = buildNoteSyncOperations({
      localNotes,
      cloudNotes,
    })

    const result = await executeNoteSyncOperations({
      operations,
      onOperationSynced: ({ syncedUpdatedAt }) => {
        if (new Date(syncedUpdatedAt).getTime() > new Date(updated.value).getTime()) {
          updated.value = syncedUpdatedAt
          writeSyncCursor(syncedUpdatedAt, currentUserId)
        }
      },
    })

    console.warn('PocketBase同步完成', {
      uploaded: result.uploaded,
      downloaded: result.downloaded,
      deleted: result.deleted,
    })

    return result
  }

  return {
    runIncrementalNoteSync,
  }
}
