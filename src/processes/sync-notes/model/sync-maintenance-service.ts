import type { CacheRepairReason } from './sync-runtime-state'
import { authService } from '@/entities/auth'
import { useNote } from '@/entities/note'
import { isInitialSyncCursor, resetSyncCursor, useSyncRuntimeState } from './sync-runtime-state'

const FULL_SCAN_UPDATED = '1970-01-01T00:00:00.000Z'

export function useSyncMaintenanceService() {
  const { getNotesByUpdated, deleteNote } = useNote()
  const { syncing, updated, pendingCacheRepairReason, ensureSyncScopeReady } = useSyncRuntimeState()

  function scheduleCacheRepair(reason: CacheRepairReason, userId?: string | null) {
    const currentUserId = ensureSyncScopeReady(userId)
    const initialUpdated = resetSyncCursor(currentUserId)

    pendingCacheRepairReason.value = reason

    console.warn('已安排缓存补齐式增量同步', {
      currentUserId,
      reason,
      updated: initialUpdated,
    })

    return reason
  }

  async function getLocalDataStats() {
    try {
      const notes = await getNotesByUpdated(FULL_SCAN_UPDATED)

      return {
        notes: notes?.length || 0,
      }
    }
    catch (error) {
      console.error('获取本地数据统计失败:', error)
      return { notes: 0 }
    }
  }

  async function ensureCacheHealth() {
    const currentUserId = ensureSyncScopeReady()
    const localStats = await getLocalDataStats()
    let repairReason: CacheRepairReason | null = pendingCacheRepairReason.value

    if (localStats.notes === 0 && !isInitialSyncCursor(updated.value)) {
      repairReason = scheduleCacheRepair('empty-local-stale-cursor', currentUserId)
    }

    if (!repairReason)
      return null

    pendingCacheRepairReason.value = null

    console.warn('执行缓存补齐式增量同步', {
      currentUserId,
      reason: repairReason,
    })

    return repairReason
  }

  async function repairMissingPrivateNoteIfNeeded(noteId: string, syncSilently: () => Promise<unknown>) {
    const currentUserId = ensureSyncScopeReady()

    if (!authService.isAuthenticated() || syncing.value)
      return false

    if (isInitialSyncCursor(updated.value)) {
      console.warn('当前已处于初始游标，跳过缺失私有备忘录补齐', {
        currentUserId,
        noteId,
      })
      return false
    }

    scheduleCacheRepair('private-note-miss', currentUserId)
    await syncSilently()
    return true
  }

  async function clearLocalData() {
    try {
      const notes = await getNotesByUpdated(FULL_SCAN_UPDATED)

      for (const note of notes || []) {
        await deleteNote(note.id)
      }

      return true
    }
    catch (error) {
      console.error('清空本地数据失败:', error)
      return false
    }
  }

  return {
    clearLocalData,
    ensureCacheHealth,
    getLocalDataStats,
    repairMissingPrivateNoteIfNeeded,
    scheduleCacheRepair,
  }
}
