import type { Ref } from 'vue'
import type { SyncableItem, SyncStatus, UseRefDBSyncOptions } from './types'
import { nextTick, ref, toRaw, watch } from 'vue'

function getCurrentTime(): string {
  return new Date().toISOString().replace('T', ' ')
}

interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void
  cancel: () => void
}

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): DebouncedFunction<T> {
  let timeout: NodeJS.Timeout | null = null
  const debounced = (...args: Parameters<T>) => {
    if (timeout)
      clearTimeout(timeout)
    timeout = setTimeout(() => {
      timeout = null
      func(...args)
    }, wait)
  }
  debounced.cancel = () => {
    if (timeout)
      clearTimeout(timeout)
    timeout = null
  }
  return debounced
}

export function useRefDBSync<T extends SyncableItem>(
  options: UseRefDBSyncOptions<T>,
) {
  const {
    data,
    table,
    idField,
    debounceMs = 300,
  } = options

  const syncStatus: Ref<SyncStatus> = ref({
    isLoading: false,
    error: null,
    lastSyncTime: null,
  })

  let lastSnapshot: T[] = []
  let lastIdSet = new Set<any>()

  async function initData() {
    try {
      await loadFromDatabase()
    }
    catch (error) {
      syncStatus.value.error = `数据初始化失败: ${error}`
      console.error('useRefDBSync: 数据初始化失败', error)
    }
  }

  async function loadFromDatabase() {
    try {
      syncStatus.value.isLoading = true
      syncStatus.value.error = null

      const dbData = await table.toArray()

      if (dbData.length > 0) {
        data.value = dbData
        updateSnapshot()
      }

      syncStatus.value.lastSyncTime = getCurrentTime()
    }
    catch (error) {
      syncStatus.value.error = `数据加载失败: ${error}`
      console.error('useRefDBSync: 数据加载失败', error)
    }
    finally {
      syncStatus.value.isLoading = false
    }
  }

  function updateSnapshot() {
    lastSnapshot = JSON.parse(JSON.stringify(data.value))
    lastIdSet = new Set(data.value.map(item => item[idField]))
  }

  function calculateChanges(newData: T[]) {
    const currentIdSet = new Set(newData.map(item => item[idField]))

    const upsertItems: T[] = []
    const lastSnapshotMap = new Map(lastSnapshot.map(item => [item[idField], item]))

    for (const item of newData) {
      const id = item[idField]
      const lastItem = lastSnapshotMap.get(id)

      if (!lastItem || item.updated > lastItem.updated) {
        const rawItem = toRaw(item)
        const normalizedItem = item.files
          ? { ...rawItem, files: toRaw(item.files) }
          : rawItem
        upsertItems.push(normalizedItem)
      }
    }

    const deleteIds: any[] = []
    for (const id of lastIdSet) {
      if (!currentIdSet.has(id)) {
        deleteIds.push(id)
      }
    }

    return { upsertItems, deleteIds }
  }

  async function syncToDatabase(newData: T[]) {
    if (!table) {
      console.warn('useRefDBSync: 数据库表未初始化')
      return
    }

    try {
      syncStatus.value.isLoading = true
      syncStatus.value.error = null

      const { upsertItems, deleteIds } = calculateChanges(newData)

      if (upsertItems.length === 0 && deleteIds.length === 0) {
        return
      }

      if (deleteIds.length > 0) {
        await table.bulkDelete(deleteIds)
      }

      if (upsertItems.length > 0) {
        await table.bulkPut(upsertItems)
      }

      updateSnapshot()
      syncStatus.value.lastSyncTime = getCurrentTime()
    }
    catch (error) {
      syncStatus.value.error = `数据同步失败: ${error}`
      console.error('useRefDBSync: 数据同步失败', error)
    }
    finally {
      syncStatus.value.isLoading = false
    }
  }

  let syncQueue = Promise.resolve()
  let autoSyncEnabled = true
  let initializationPromise: Promise<void> = Promise.resolve()

  function enqueueSync(newData: T[]) {
    const operation = syncQueue.then(() => syncToDatabase(newData))
    syncQueue = operation.catch(() => undefined)
    return operation
  }

  const debouncedSync = debounce((newData: T[]) => {
    if (autoSyncEnabled)
      void enqueueSync(newData)
  }, debounceMs)

  async function manualSync() {
    debouncedSync.cancel()
    await enqueueSync(data.value)
  }

  async function clearDatabase() {
    try {
      await table.clear()
      data.value = []
      updateSnapshot()
      syncStatus.value.lastSyncTime = getCurrentTime()
    }
    catch (error) {
      syncStatus.value.error = `清空数据库失败: ${error}`
      console.error('useRefDBSync: 清空数据库失败', error)
    }
  }

  let watchStopHandle: (() => void) | null = null

  function startAutoSync() {
    autoSyncEnabled = true
    if (watchStopHandle)
      return

    watchStopHandle = watch(
      data,
      (newData) => {
        debouncedSync(newData)
      },
      { deep: true },
    )
  }

  async function stopAutoSync() {
    autoSyncEnabled = false
    debouncedSync.cancel()
    if (watchStopHandle) {
      watchStopHandle()
      watchStopHandle = null
    }
    await initializationPromise
    await syncQueue
  }

  initializationPromise = nextTick().then(async () => {
    if (!autoSyncEnabled)
      return
    await initData()
    if (autoSyncEnabled)
      startAutoSync()
  })

  return {
    syncStatus,
    manualSync,
    clearDatabase,
    startAutoSync,
    stopAutoSync,
    getCurrentTime,
  }
}
