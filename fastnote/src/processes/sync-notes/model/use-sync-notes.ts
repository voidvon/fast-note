/**
 * 数据同步 Hook
 * 提供笔记与 PocketBase 的双向同步功能
 */
import { authService } from '@/entities/auth'
import { useSyncMaintenanceService } from './sync-maintenance-service'
import { useSyncOrchestratorService } from './sync-orchestrator-service'
import { useSyncRuntimeState } from './sync-runtime-state'
import { useSyncStatusState } from './sync-status-state'

export {
  getInitialSyncCursor,
  getSyncCursorStorageKey,
  isInitialSyncCursor,
  readSyncCursor,
  resetSyncCursor,
  SYNC_CURSOR_STORAGE_PREFIX,
  writeSyncCursor,
} from './sync-runtime-state'
export type { CacheRepairReason } from './sync-runtime-state'

export function useSync() {
  const {
    ensureSyncScopeReady,
    offOnSynced,
    onSynced,
    syncing,
    triggerSyncedCallbacks,
    updated,
  } = useSyncRuntimeState()
  const {
    clearLocalData,
    ensureCacheHealth,
    getLocalDataStats,
    repairMissingPrivateNoteIfNeeded: repairMissingPrivateNoteWithCacheRepair,
  } = useSyncMaintenanceService()
  const { runIncrementalNoteSync } = useSyncOrchestratorService()
  const { markSyncFailed, markSyncSucceeded, syncStatus } = useSyncStatusState()

  /**
   * 主同步函数
   * @param silent 是否静默同步，静默模式下未登录不会抛出错误，直接返回 null
   */
  async function sync(silent = false) {
    ensureSyncScopeReady()

    // 检查登录状态
    if (!authService.isAuthenticated()) {
      if (silent) {
        // 静默模式：未登录时直接返回，不显示任何提示
        console.warn('用户未登录，跳过同步')
        return null
      }
      else {
        // 非静默模式：抛出错误，让调用方处理并显示提示
        throw new Error('用户未登录，请先登录')
      }
    }

    const cacheRepairReason = await ensureCacheHealth()

    if (cacheRepairReason) {
      console.warn('本次同步将以补齐模式执行', {
        cacheRepairReason,
        updated: updated.value,
      })
    }

    syncing.value = true

    try {
      const result = await runIncrementalNoteSync()
      triggerSyncedCallbacks(result)
      return result
    }
    catch (error) {
      console.error('PocketBase同步失败', error)
      throw error // 重新抛出错误，停止同步
    }
    finally {
      syncing.value = false
    }
  }

  async function repairMissingPrivateNoteIfNeeded(noteId: string) {
    return await repairMissingPrivateNoteWithCacheRepair(noteId, () => sync(true))
  }

  /**
   * 双向同步（别名）
   * @param silent 是否静默同步
   */
  async function bidirectionalSync(silent = false) {
    try {
      const result = await sync(silent)
      markSyncSucceeded()
      return result
    }
    catch (error) {
      markSyncFailed(error)
      throw error
    }
  }

  /**
   * 全量上传到 PocketBase
   * @param silent 是否静默同步
   */
  async function fullSyncToPocketBase(silent = false) {
    try {
      const result = await sync(silent)
      return result
    }
    catch (error) {
      console.error('全量上传失败:', error)
      throw error
    }
  }

  return {
    sync,
    syncing,
    onSynced,
    offOnSynced,
    syncStatus,
    bidirectionalSync,
    fullSyncToPocketBase,
    getLocalDataStats,
    clearLocalData,
    ensureCacheHealth,
    repairMissingPrivateNoteIfNeeded,
  }
}
