import { ref } from 'vue'
import { useSyncRuntimeState } from './sync-runtime-state'

interface SyncStatusState {
  isSync: ReturnType<typeof useSyncRuntimeState>['syncing']
  currentStep: string
  progress: number
  error: string | null
  lastSyncTime: Date | null
  attachments: {
    total: number
    ready: number
    failed: number
    missing: number
    pending: number
    hydrated: boolean
    quotaExceeded: boolean
  }
}

const { syncing } = useSyncRuntimeState()

const syncStatus = ref<SyncStatusState>({
  isSync: syncing,
  currentStep: '准备同步...',
  progress: 0,
  error: null,
  lastSyncTime: null,
  attachments: {
    total: 0,
    ready: 0,
    failed: 0,
    missing: 0,
    pending: 0,
    hydrated: true,
    quotaExceeded: false,
  },
})

export function useSyncStatusState() {
  function markSyncSucceeded() {
    syncStatus.value.lastSyncTime = new Date()
    syncStatus.value.error = null
  }

  function markSyncFailed(error: unknown) {
    syncStatus.value.error = error instanceof Error ? error.message : '同步失败'
  }

  function updateAttachmentStatus(status: SyncStatusState['attachments']) {
    syncStatus.value.attachments = status
    syncStatus.value.currentStep = status.hydrated
      ? '附件已全部离线可用'
      : `附件同步中 ${status.ready}/${status.total}`
    syncStatus.value.progress = status.total === 0 ? 100 : Math.round(status.ready / status.total * 100)
  }

  return {
    markSyncFailed,
    markSyncSucceeded,
    updateAttachmentStatus,
    syncStatus,
  }
}
