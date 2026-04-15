import { ref } from 'vue'
import { useSyncRuntimeState } from './sync-runtime-state'

interface SyncStatusState {
  isSync: ReturnType<typeof useSyncRuntimeState>['syncing']
  currentStep: string
  progress: number
  error: string | null
  lastSyncTime: Date | null
}

const { syncing } = useSyncRuntimeState()

const syncStatus = ref<SyncStatusState>({
  isSync: syncing,
  currentStep: '准备同步...',
  progress: 0,
  error: null,
  lastSyncTime: null,
})

export function useSyncStatusState() {
  function markSyncSucceeded() {
    syncStatus.value.lastSyncTime = new Date()
    syncStatus.value.error = null
  }

  function markSyncFailed(error: unknown) {
    syncStatus.value.error = error instanceof Error ? error.message : '同步失败'
  }

  return {
    markSyncFailed,
    markSyncSucceeded,
    syncStatus,
  }
}
