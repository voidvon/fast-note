import { getAttachmentHydrationStatus, reconcileRemoteNoteAttachmentRefs } from '@/entities/attachment'
import { buildNoteSyncOperations, noteRemoteService, useNote, useNotePurgeService, useNoteSyncExecutorService } from '@/entities/note'
import { preparePersistentStorage } from '@/shared/lib/storage'
import { useSyncManifestService } from './sync-manifest-service'
import { useSyncRuntimeState, writeSyncCursor } from './sync-runtime-state'

export function useSyncOrchestratorService() {
  const { getNotesByUpdated, notes } = useNote()
  const { executeNoteSyncOperations } = useNoteSyncExecutorService()
  const { ensureSyncScopeReady, updated } = useSyncRuntimeState()
  const { queueExpiredNotePurges, runPendingNotePurges } = useNotePurgeService()
  const { reconcileRemoteNoteManifest } = useSyncManifestService()

  async function runIncrementalNoteSync() {
    const currentUserId = ensureSyncScopeReady()

    console.warn('PocketBase同步开始，updated:', updated.value)

    await queueExpiredNotePurges()
    await runPendingNotePurges()
    await preparePersistentStorage()

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

    const manifest = await reconcileRemoteNoteManifest()
    for (const note of notes.value)
      await reconcileRemoteNoteAttachmentRefs(note)
    const attachments = await getAttachmentHydrationStatus()

    console.warn('PocketBase同步完成', {
      uploaded: result.uploaded,
      downloaded: result.downloaded,
      deleted: result.deleted,
      manifest,
      attachments,
    })

    return { ...result, attachments, manifest }
  }

  return {
    runIncrementalNoteSync,
  }
}
