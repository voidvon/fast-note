/**
 * 数据同步 Hook
 * 提供笔记与 PocketBase 的双向同步功能
 */
import type { Note } from '@/types'
import { ref } from 'vue'
import { useNote, useNoteFiles } from '@/entities/note'
import { authService, notesService } from '@/shared/api/pocketbase'
import { getTime } from '@/utils/date'
import { createScopedStorageKey, resolveScopedUserId } from '@/utils/userScope'

export const SYNC_CURSOR_STORAGE_PREFIX = 'pocketbaseUpdated'

const defaultUpdated = JSON.stringify(getTime('2010/01/01 00:00:00'))

export type CacheRepairReason = 'empty-local-stale-cursor' | 'private-note-miss'

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

const syncScopeUserId = ref<string | null>(resolveScopedUserId())
const updated = ref(readSyncCursor(syncScopeUserId.value))

export function writeSyncCursor(updatedAt: string, userId?: string | null) {
  const currentUserId = resolveScopedUserId(userId)

  localStorage.setItem(getSyncCursorStorageKey(currentUserId), JSON.stringify(updatedAt))

  if (syncScopeUserId.value === currentUserId) {
    updated.value = updatedAt
  }
}

const syncing = ref(false)
// 存储同步成功的回调函数
const syncSyncedCallbacks: Array<(result?: any) => void> = []

function ensureSyncScopeReady(userId = resolveScopedUserId()) {
  if (syncScopeUserId.value !== userId) {
    syncScopeUserId.value = userId
    updated.value = readSyncCursor(userId)
  }

  return userId
}

const pendingCacheRepairReason = ref<CacheRepairReason | null>(null)

export function resetSyncCursor(userId?: string | null) {
  const currentUserId = ensureSyncScopeReady(userId)
  const initialUpdated = getInitialSyncCursor()

  updated.value = initialUpdated
  writeSyncCursor(initialUpdated, currentUserId)

  return initialUpdated
}

export function useSync() {
  const { getNotesByUpdated, getNote, addNote, deleteNote, updateNote } = useNote()
  const { getNoteFileByHash } = useNoteFiles()

  function hasRemoteUserId(note: Pick<Note, 'user_id'>) {
    return typeof note.user_id === 'string' && note.user_id.trim().length > 0
  }

  async function backfillRemoteNoteMetadata(noteId: string, record: Partial<Note> | null | undefined) {
    if (!record)
      return null

    const updates: Partial<Note> = {}

    if (typeof record.user_id === 'string' && record.user_id.trim()) {
      updates.user_id = record.user_id
    }

    if (typeof record.updated === 'string' && record.updated) {
      updates.updated = record.updated
    }

    if (Array.isArray(record.files)) {
      updates.files = record.files
    }

    if (Object.keys(updates).length === 0)
      return null

    await updateNote(noteId, updates)
    return updates.updated || null
  }

  /**
   * 从笔记内容中提取文件引用
   */
  function extractFileReferencesFromContent(content: string): string[] {
    // 提取 file-upload 元素的 url 属性（hash值或pocketbase文件名）
    const fileRefRegex = /<file-upload[^>]+url="([^"]+)"/g
    const fileReferences: string[] = []
    let match = fileRefRegex.exec(content)

    while (match !== null) {
      fileReferences.push(match[1])
      match = fileRefRegex.exec(content)
    }

    return fileReferences
  }

  /**
   * 检查字符串是否为SHA256 hash值（64位十六进制）
   */
  function isHashValue(str: string): boolean {
    return /^[a-f0-9]{64}$/i.test(str)
  }

  /**
   * 生成临时文件标识符
   */
  function generateTempFileId(index: number): string {
    return `__TEMP_FILE_${index}__`
  }

  /**
   * 优雅的附件处理方案
   * 使用临时标识符简化映射关系，减少网络请求
   * 支持同一个文件在富文本中多处引用
   */
  async function handleNoteFilesElegant(note: Note): Promise<{
    updatedNote: Note
    filesForUpload: Array<File | string> | undefined
    fileMapping: Map<string, string> // hash到临时标识符的映射
  }> {
    // 从内容中提取文件引用（如果有内容的话）
    const fileReferences = note.content ? extractFileReferencesFromContent(note.content) : []

    // 如果富文本中没有任何文件引用，返回原笔记
    if (fileReferences.length === 0) {
      return {
        updatedNote: note,
        filesForUpload: undefined,
        fileMapping: new Map(),
      }
    }

    let updatedContent = note.content || ''
    const filesForUpload: Array<File | string> = []
    const hashToTempIdMapping = new Map<string, string>() // hash到临时标识符的映射
    const processedFiles = new Set<string>() // 已处理的文件（去重用）
    let tempFileIndex = 0

    // 第一阶段：处理所有文件引用，将hash值替换为临时标识符
    for (const hashOrFilename of fileReferences) {
      try {
        // 判断是hash值还是pocketbase文件名
        if (isHashValue(hashOrFilename)) {
          // 是hash值，尝试获取本地文件
          const localFile = await getNoteFileByHash(hashOrFilename)

          if (localFile && localFile.file) {
            let tempId: string

            // 检查是否已经处理过这个hash
            if (hashToTempIdMapping.has(hashOrFilename)) {
              // 已处理过，使用已有的临时标识符
              tempId = hashToTempIdMapping.get(hashOrFilename)!
            }
            else {
              // 首次处理，生成新的临时标识符
              tempId = generateTempFileId(tempFileIndex)
              tempFileIndex++

              // 记录映射关系
              hashToTempIdMapping.set(hashOrFilename, tempId)

              // 只在首次处理时添加到上传列表（避免重复）
              filesForUpload.push(localFile.file)
            }

            // 在富文本中将hash替换为临时标识符（可能有多处）
            const hashRegex = new RegExp(
              `(<file-upload[^>]+url=")${hashOrFilename}("[^>]*>)`,
              'g',
            )
            updatedContent = updatedContent.replace(hashRegex, `$1${tempId}$2`)

            console.warn(`将hash ${hashOrFilename} 替换为临时标识符 ${tempId}`)
          }
          else {
            console.warn(`本地文件未找到: ${hashOrFilename}`)
            // 如果本地文件不存在，跳过该文件（避免上传无效数据）
          }
        }
        else {
          // 不是hash值，认为是pocketbase文件名
          // 只在首次遇到时添加到上传列表（避免重复）
          if (!processedFiles.has(hashOrFilename)) {
            filesForUpload.push(hashOrFilename)
            processedFiles.add(hashOrFilename)
          }
        }
      }
      catch (error) {
        console.error(`处理文件失败: ${hashOrFilename}`, error)
        // 发生错误时，如果不是hash值则保留，避免丢失pocketbase文件
        if (!isHashValue(hashOrFilename) && !processedFiles.has(hashOrFilename)) {
          filesForUpload.push(hashOrFilename)
          processedFiles.add(hashOrFilename)
        }
      }
    }

    return {
      updatedNote: { ...note, content: updatedContent },
      filesForUpload: filesForUpload.length > 0 ? filesForUpload : [],
      fileMapping: hashToTempIdMapping,
    }
  }

  /**
   * 处理PocketBase返回结果，将临时标识符替换为真实文件名
   * 现在 filesForUpload 已经去重，与 pocketbaseFiles 长度一致
   */
  function processUploadResult(
    content: string,
    filesForUpload: Array<File | string>,
    pocketbaseFiles: string[],
  ): string {
    console.warn('调试信息 - processUploadResult 输入:')
    console.warn('filesForUpload:', filesForUpload.map(item => item instanceof File ? `File(${item.name})` : item))
    console.warn('pocketbaseFiles:', pocketbaseFiles)
    console.warn('原始内容:', content)

    let updatedContent = content
    let fileObjectIndex = 0

    // 遍历去重后的文件数组，建立 File 对象到 PocketBase 文件名的映射
    for (let i = 0; i < filesForUpload.length; i++) {
      const item = filesForUpload[i]

      // 如果是File对象，说明对应一个临时标识符
      if (item instanceof File) {
        const tempId = generateTempFileId(fileObjectIndex)

        // 确保PocketBase返回的文件数组有足够的文件
        if (i < pocketbaseFiles.length) {
          const pocketbaseFilename = pocketbaseFiles[i]

          console.warn(`调试: 处理第 ${fileObjectIndex} 个File对象 (数组索引 ${i}), 临时ID: ${tempId}, 目标文件名: ${pocketbaseFilename}`)

          // 将临时标识符替换为PocketBase文件名（可能有多处引用）
          const tempIdRegex = new RegExp(
            `(<file-upload[^>]+url=")${tempId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}("[^>]*>)`,
            'g',
          )
          const beforeReplace = updatedContent
          updatedContent = updatedContent.replace(tempIdRegex, `$1${pocketbaseFilename}$2`)

          console.warn(`替换结果: ${beforeReplace === updatedContent ? '未找到匹配' : '替换成功'}`)
          console.warn(`将临时标识符 ${tempId} 替换为 PocketBase 文件名 ${pocketbaseFilename}`)
        }
        else {
          console.error(`File对象 ${fileObjectIndex} 没有对应的新上传文件！`)
        }

        fileObjectIndex++
      }
    }

    console.warn('最终内容:', updatedContent)
    return updatedContent
  }

  /**
   * 注册同步成功的回调函数
   */
  function onSynced(callback: (result?: any) => void) {
    if (typeof callback === 'function') {
      syncSyncedCallbacks.push(callback)
    }

    // 返回取消注册的函数
    return () => offOnSynced(callback)
  }

  /**
   * 移除同步成功的回调函数
   */
  function offOnSynced(callback: (result?: any) => void) {
    const index = syncSyncedCallbacks.indexOf(callback)
    if (index !== -1) {
      syncSyncedCallbacks.splice(index, 1)
    }
  }

  /**
   * 触发同步成功的回调函数
   */
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

  async function repairMissingPrivateNoteIfNeeded(noteId: string) {
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
    await sync(true)
    return true
  }

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
      const result = await syncNote()
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

  /**
   * 同步笔记
   */
  async function syncNote() {
    const currentUserId = ensureSyncScopeReady()

    console.warn('PocketBase同步开始，updated:', updated.value)

    // 获取本地变更数据
    const localNotes = await getNotesByUpdated(updated.value)
    console.warn('本地笔记变更:', localNotes)

    // 获取云端变更数据
    const cloudNotes = await notesService.getNotesByUpdated(updated.value)
    console.warn('云端笔记变更:', cloudNotes)

    // content 转义处理（PocketBase可能也需要）
    cloudNotes.d.forEach((note: any) => {
      if (note.content) {
        note.content = note.content.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      }
    })

    // 创建ID映射以便快速查找
    const localNotesMap = new Map(localNotes.map(note => [note.id, note]))
    const cloudNotesMap = new Map((cloudNotes.d as Note[]).map(note => [note.id, note]))

    // 准备需要处理的操作列表
    interface SyncOperation {
      note: Note
      action: 'upload' | 'update' | 'download' | 'delete' | 'deleteLocal' | 'skip'
    }

    const operations: SyncOperation[] = []
    const now = Date.now()
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000 // 30天的毫秒数

    // 处理本地笔记
    for (const note of localNotes) {
      const cloudNote = cloudNotesMap.get(note.id)
      const isSyncedNote = hasRemoteUserId(note)
      const localTime = new Date(note.updated).getTime()
      const cloudTime = cloudNote ? new Date(cloudNote.updated).getTime() : null

      // 处理本地已删除的笔记
      if (note.is_deleted === 1) {
        // 如果删除时间超过30天
        if (now - localTime > thirtyDaysInMs) {
          // 从本地删除
          operations.push({ note, action: 'deleteLocal' })

          // 已同步过的笔记需要继续同步删除状态到云端
          if (isSyncedNote) {
            const noteToUpdate = { ...note }
            operations.push({ note: noteToUpdate, action: 'delete' })
          }
          continue
        }

        // 未同步过的删除笔记只保留本地删除态，不创建云端墓碑
        if (!isSyncedNote) {
          operations.push({ note, action: 'skip' })
          continue
        }

        // 已同步过的删除笔记需要同步删除状态
        if (!cloudNote || cloudTime === null || localTime > cloudTime) {
          const noteToUpdate = { ...note }
          operations.push({ note: noteToUpdate, action: 'delete' })
        }
        else if (localTime < cloudTime) {
          operations.push({ note: cloudNote, action: 'download' })
        }
        continue
      }

      if (!isSyncedNote) {
        // 本地未同步过的笔记首次上传到云端
        operations.push({ note, action: 'upload' })
        continue
      }

      // 处理未删除的笔记
      if (!cloudNote) {
        // 已同步过但本次云端增量中未出现，仍应按更新处理
        operations.push({ note, action: 'update' })
      }
      else {
        // 本地和云端都存在 - 比较时间戳
        const remoteUpdatedTime = new Date(cloudNote.updated).getTime()

        if (localTime > remoteUpdatedTime) {
          // 本地版本更新，上传到云端
          const noteToUpdate = { ...note }
          operations.push({ note: noteToUpdate, action: 'update' })
        }
        else if (localTime < remoteUpdatedTime) {
          // 云端版本更新，下载到本地
          operations.push({ note: cloudNote, action: 'download' })
        }
      }
    }

    // 处理云端笔记
    for (const note of cloudNotes.d as Note[]) {
      const localNote = localNotesMap.get(note.id)

      // 处理云端已删除的笔记
      if (note.is_deleted === 1) {
        // 如果删除时间超过30天且本地存在，从本地删除
        if (now - new Date(note.updated).getTime() > thirtyDaysInMs) {
          if (localNote) {
            operations.push({ note, action: 'deleteLocal' })
          }
          continue
        }

        // 如果本地不存在且删除时间在30天内，下载到本地
        if (!localNote) {
          operations.push({ note, action: 'download' })
          continue
        }

        // 如果本地存在，比较时间戳
        const localTime = new Date(localNote.updated).getTime()
        const cloudTime = new Date(note.updated).getTime()

        if (cloudTime > localTime) {
          // 云端时间更新，更新本地数据
          operations.push({ note, action: 'download' })
        }
        continue
      }

      // 处理未删除的笔记
      if (!localNote) {
        // 云端存在但本地不存在 - 下载到本地
        operations.push({ note, action: 'download' })
      }
      else {
        // 本地和云端都存在 - 比较时间戳
        const localTime = new Date(localNote.updated).getTime()
        const cloudTime = new Date(note.updated).getTime()

        if (cloudTime > localTime) {
          // 云端时间更新，更新本地数据
          operations.push({ note, action: 'download' })
        }
      }
    }

    // 按照updated顺序排序所有操作
    operations.sort((a, b) => new Date(a.note.updated).getTime() - new Date(b.note.updated).getTime())

    // 统计同步结果
    let uploadedCount = 0
    let downloadedCount = 0
    let deletedCount = 0

    // 按顺序执行所有同步操作
    for (const { note, action } of operations) {
      try {
        let syncedUpdatedAt = note.updated

        if (action === 'upload') {
          // 使用新的优雅方案处理附件
          const { updatedNote, filesForUpload } = await handleNoteFilesElegant(note)

          // 上传到PocketBase
          const result = filesForUpload !== undefined
            ? await notesService.updateNote(updatedNote, filesForUpload, 'create')
            : await notesService.updateNote(updatedNote, undefined, 'create')

          const remoteUpdatedAt = await backfillRemoteNoteMetadata(note.id, result.record)
          syncedUpdatedAt = remoteUpdatedAt || syncedUpdatedAt

          // 如果有需要上传的文件，处理返回结果
          if (filesForUpload && filesForUpload.length > 0 && result.success && result.record) {
            const uploadedRecord = result.record

            if (uploadedRecord.files && Array.isArray(uploadedRecord.files)) {
              // 处理PocketBase返回的文件名，更新临时标识符
              const finalContent = processUploadResult(
                updatedNote.content || '',
                filesForUpload,
                uploadedRecord.files,
              )

              // 如果内容有变化，更新本地笔记并同步到服务端
              if (finalContent !== updatedNote.content) {
                const finalNote = {
                  ...updatedNote,
                  content: finalContent,
                  files: uploadedRecord.files,
                  updated: getTime(),
                }
                // 更新本地笔记
                await updateNote(note.id, finalNote)
                // 将更新后的内容同步到PocketBase服务端（不包含文件，只更新内容）
                const finalResult = await notesService.updateNote(finalNote, undefined, 'update')
                const finalRemoteUpdatedAt = await backfillRemoteNoteMetadata(note.id, finalResult.record)
                syncedUpdatedAt = finalRemoteUpdatedAt || finalNote.updated
                console.warn(`已更新笔记 ${note.id} 的附件引用并同步到服务端`)
              }
            }
          }

          uploadedCount++
        }
        else if (action === 'update') {
          // 使用新的优雅方案处理附件
          const { updatedNote, filesForUpload } = await handleNoteFilesElegant(note)

          // 上传到PocketBase
          const result = filesForUpload !== undefined
            ? await notesService.updateNote(updatedNote, filesForUpload, 'update')
            : await notesService.updateNote(updatedNote, undefined, 'update')

          const remoteUpdatedAt = await backfillRemoteNoteMetadata(note.id, result.record)
          syncedUpdatedAt = remoteUpdatedAt || syncedUpdatedAt

          // 如果有需要上传的文件，处理返回结果
          if (filesForUpload && filesForUpload.length > 0 && result.success && result.record) {
            const uploadedRecord = result.record

            if (uploadedRecord.files && Array.isArray(uploadedRecord.files)) {
              // 处理PocketBase返回的文件名，更新临时标识符
              const finalContent = processUploadResult(
                updatedNote.content || '',
                filesForUpload,
                uploadedRecord.files,
              )

              // 如果内容有变化，更新本地笔记并同步到服务端
              if (finalContent !== updatedNote.content) {
                const finalNote = {
                  ...updatedNote,
                  content: finalContent,
                  files: uploadedRecord.files,
                  updated: getTime(),
                }
                // 更新本地笔记
                await updateNote(note.id, finalNote)
                // 将更新后的内容同步到PocketBase服务端（不包含文件，只更新内容）
                const finalResult = await notesService.updateNote(finalNote, undefined, 'update')
                const finalRemoteUpdatedAt = await backfillRemoteNoteMetadata(note.id, finalResult.record)
                syncedUpdatedAt = finalRemoteUpdatedAt || finalNote.updated
                console.warn(`已更新笔记 ${note.id} 的附件引用并同步到服务端`)
              }
            }
          }

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
          // 请求云端删除（标记为删除状态）
          const result = await notesService.updateNote(note, undefined, 'update')
          const remoteUpdatedAt = await backfillRemoteNoteMetadata(note.id, result.record)
          syncedUpdatedAt = remoteUpdatedAt || syncedUpdatedAt
          deletedCount++
        }

        // 每成功同步一条记录，就更新updated
        if (new Date(syncedUpdatedAt).getTime() > new Date(updated.value).getTime()) {
          updated.value = syncedUpdatedAt
          writeSyncCursor(syncedUpdatedAt, currentUserId)
        }
      }
      catch (error) {
        console.error(`PocketBase同步操作失败 (${action}):`, error)
        throw error // 停止同步，不再继续处理后续记录
      }
    }

    console.warn('PocketBase同步完成', {
      uploaded: uploadedCount,
      downloaded: downloadedCount,
      deleted: deletedCount,
    })

    return {
      uploaded: uploadedCount,
      downloaded: downloadedCount,
      deleted: deletedCount,
    }
  }

  // 同步状态对象
  const syncStatus = ref({
    isSync: syncing,
    currentStep: '准备同步...',
    progress: 0,
    error: null as string | null,
    lastSyncTime: null as Date | null,
  })

  /**
   * 双向同步（别名）
   * @param silent 是否静默同步
   */
  async function bidirectionalSync(silent = false) {
    try {
      const result = await sync(silent)
      syncStatus.value.lastSyncTime = new Date()
      syncStatus.value.error = null
      return result
    }
    catch (error) {
      syncStatus.value.error = error instanceof Error ? error.message : '同步失败'
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

  /**
   * 获取本地数据统计
   */
  async function getLocalDataStats() {
    const { getNotesByUpdated } = useNote()

    try {
      const notes = await getNotesByUpdated('1970-01-01T00:00:00.000Z')

      return {
        notes: notes?.length || 0,
      }
    }
    catch (error) {
      console.error('获取本地数据统计失败:', error)
      return { notes: 0 }
    }
  }

  /**
   * 清空本地数据
   */
  async function clearLocalData() {
    const { deleteNote, getNotesByUpdated } = useNote()

    try {
      // 获取所有本地数据
      const notes = await getNotesByUpdated('1970-01-01T00:00:00.000Z')

      // 删除所有笔记
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
