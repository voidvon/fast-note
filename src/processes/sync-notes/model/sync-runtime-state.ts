import { ref } from 'vue'
import { getTime } from '@/shared/lib/date'
import { createScopedStorageKey, resolveScopedUserId } from '@/shared/lib/user-scope'

export const SYNC_CURSOR_STORAGE_PREFIX = 'pocketbaseUpdated'

const defaultUpdated = JSON.stringify(getTime('2010/01/01 00:00:00'))

export type CacheRepairReason = 'empty-local-stale-cursor' | 'private-note-miss'

const syncScopeUserId = ref<string | null>(resolveScopedUserId())
const updated = ref(readSyncCursor(syncScopeUserId.value))
const syncing = ref(false)
const pendingCacheRepairReason = ref<CacheRepairReason | null>(null)
const syncSyncedCallbacks: Array<(result?: any) => void> = []

export function getInitialSyncCursor() {
  return JSON.parse(defaultUpdated)
}

export function isInitialSyncCursor(updatedAt: string) {
  return updatedAt === getInitialSyncCursor()
}

export function getSyncCursorStorageKey(userId?: string | null) {
  return createScopedStorageKey(SYNC_CURSOR_STORAGE_PREFIX, userId)
}

export function readSyncCursor(userId?: string | null) {
  return JSON.parse(localStorage.getItem(getSyncCursorStorageKey(userId)) || defaultUpdated)
}

export function writeSyncCursor(updatedAt: string, userId?: string | null) {
  const currentUserId = resolveScopedUserId(userId)

  localStorage.setItem(getSyncCursorStorageKey(currentUserId), JSON.stringify(updatedAt))

  if (syncScopeUserId.value === currentUserId) {
    updated.value = updatedAt
  }
}

function ensureSyncScopeReady(userId = resolveScopedUserId()) {
  if (syncScopeUserId.value !== userId) {
    syncScopeUserId.value = userId
    updated.value = readSyncCursor(userId)
  }

  return userId
}

export function resetSyncCursor(userId?: string | null) {
  const currentUserId = ensureSyncScopeReady(userId)
  const initialUpdated = getInitialSyncCursor()

  updated.value = initialUpdated
  writeSyncCursor(initialUpdated, currentUserId)

  return initialUpdated
}

function onSynced(callback: (result?: any) => void) {
  if (typeof callback === 'function') {
    syncSyncedCallbacks.push(callback)
  }

  return () => offOnSynced(callback)
}

function offOnSynced(callback: (result?: any) => void) {
  const index = syncSyncedCallbacks.indexOf(callback)
  if (index !== -1) {
    syncSyncedCallbacks.splice(index, 1)
  }
}

function triggerSyncedCallbacks(result?: any) {
  for (const callback of syncSyncedCallbacks) {
    try {
      callback(result)
    }
    catch (error) {
      console.error('执行同步成功回调函数失败:', error)
    }
  }
}

export function useSyncRuntimeState() {
  return {
    syncing,
    updated,
    pendingCacheRepairReason,
    ensureSyncScopeReady,
    onSynced,
    offOnSynced,
    triggerSyncedCallbacks,
  }
}
