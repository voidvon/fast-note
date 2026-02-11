import type { Ref } from 'vue'
import type { SyncableItem, SyncStatus, UseRefDBSyncOptions } from './types'
import { nextTick, ref, toRaw, watch } from 'vue'

/**
 * 生成 ISO 8601 格式的时间戳（使用空格分隔日期和时间）
 */
function getCurrentTime(): string {
  return new Date().toISOString().replace('T', ' ')
}

/**
 * 防抖函数
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout)
      clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Vue 3 响应式同步插件: useRefDBSync
 *
 * 创建一个响应式的 ref 对象，并将其内容自动、高效地单向同步到 IndexedDB 数据表中
 *
 * @param options 配置选项
 * @returns 响应式数据和同步状态
 */
export function useRefDBSync<T extends SyncableItem>(
  options: UseRefDBSyncOptions<T>,
) {
  const {
    data,
    table,
    idField,
    debounceMs = 300,
  } = options

  // 同步状态
  const syncStatus: Ref<SyncStatus> = ref({
    isLoading: false,
    error: null,
    lastSyncTime: null,
  })

  // 上一次同步时的数据快照
  let lastSnapshot: T[] = []
  let lastIdSet = new Set<any>()

  /**
   * 初始化数据
   */
  async function initData() {
    try {
      // 从数据库加载初始数据
      await loadFromDatabase()
    }
    catch (error) {
      syncStatus.value.error = `数据初始化失败: ${error}`
      console.error('useRefDBSync: 数据初始化失败', error)
    }
  }

  /**
   * 从数据库加载数据
   */
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

  /**
   * 更新数据快照
   */
  function updateSnapshot() {
    lastSnapshot = JSON.parse(JSON.stringify(data.value))
    lastIdSet = new Set(data.value.map(item => item[idField]))
  }

  /**
   * 计算数据变更
   */
  function calculateChanges(newData: T[]) {
    const currentIdSet = new Set(newData.map(item => item[idField]))

    // 找出新增和修改的项目
    const upsertItems: T[] = []
    const lastSnapshotMap = new Map(lastSnapshot.map(item => [item[idField], item]))

    for (const item of newData) {
      const id = item[idField]
      const lastItem = lastSnapshotMap.get(id)

      if (!lastItem || item.updated > lastItem.updated) {
        // 新增项目 - 直接使用 toRaw 转换
        if (item.files) {
          item.files = toRaw(item.files)
        }
        upsertItems.push(toRaw(item))
      }
    }

    // 找出需要删除的项目
    const deleteIds: any[] = []
    for (const id of lastIdSet) {
      if (!currentIdSet.has(id)) {
        deleteIds.push(id)
      }
    }

    return { upsertItems, deleteIds }
  }

  /**
   * 同步数据到数据库
   */
  async function syncToDatabase(newData: T[]) {
    if (!table) {
      console.warn('useRefDBSync: 数据库表未初始化')
      return
    }

    try {
      syncStatus.value.isLoading = true
      syncStatus.value.error = null

      const { upsertItems, deleteIds } = calculateChanges(newData)

      // 如果没有变更，直接返回
      if (upsertItems.length === 0 && deleteIds.length === 0) {
        return
      }

      // 删除操作
      if (deleteIds.length > 0) {
        await table.bulkDelete(deleteIds)
      }

      // 新增/更新操作
      if (upsertItems.length > 0) {
        await table.bulkPut(upsertItems)
      }

      // 更新快照
      updateSnapshot()
      syncStatus.value.lastSyncTime = getCurrentTime()

      // console.log(`useRefDBSync: 同步完成 - 新增/更新: ${upsertItems.length}, 删除: ${deleteIds.length}`)
    }
    catch (error) {
      syncStatus.value.error = `数据同步失败: ${error}`
      console.error('useRefDBSync: 数据同步失败', error)
    }
    finally {
      syncStatus.value.isLoading = false
    }
  }

  // 创建防抖的同步函数
  const debouncedSync = debounce(syncToDatabase, debounceMs)

  /**
   * 手动触发同步
   */
  async function manualSync() {
    await syncToDatabase(data.value)
  }

  /**
   * 清空数据库表
   */
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

  // 监听数据变化并自动同步
  let watchStopHandle: (() => void) | null = null

  /**
   * 启动自动同步
   */
  function startAutoSync() {
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

  /**
   * 停止自动同步
   */
  function stopAutoSync() {
    if (watchStopHandle) {
      watchStopHandle()
      watchStopHandle = null
    }
  }

  // 初始化
  nextTick(async () => {
    await initData()
    startAutoSync()
  })

  return {
    // 同步状态
    syncStatus,

    // 控制方法
    manualSync,
    clearDatabase,
    startAutoSync,
    stopAutoSync,

    // 工具方法
    getCurrentTime,
  }
}
