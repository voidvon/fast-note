import type { FolderTreeNode, Note } from '@/types'
import { onUnmounted, ref } from 'vue'
import { useDexie, useRefDBSync } from '@/database'
import { NOTE_TYPE } from '@/types'
import { getTime } from '@/utils/date'

type UpdateFn = (item: Note) => void

const notes = ref<Note[]>([])
// 添加索引 Map 提升查询性能
const notesMap = ref<Map<string, Note>>(new Map())
const parentIdMap = ref<Map<string, Note[]>>(new Map())
let initializing = false
let isInitialized = false
const onNoteUpdateArr: UpdateFn[] = []

// 全局同步实例
let notesSync: ReturnType<typeof useRefDBSync<Note>> | null = null

/**
 * 重建索引 Map
 */
function rebuildIndexMaps() {
  // 清空现有索引
  notesMap.value.clear()
  parentIdMap.value.clear()

  // 重建 ID 索引 Map
  for (const note of notes.value) {
    if (note.id) {
      notesMap.value.set(note.id, note)
    }
  }

  // 重建父级 ID 索引 Map
  const parentGroups = new Map<string, Note[]>()
  for (const note of notes.value) {
    const parentId = note.parent_id || 'root'
    if (!parentGroups.has(parentId)) {
      parentGroups.set(parentId, [])
    }
    parentGroups.get(parentId)!.push(note)
  }
  parentIdMap.value = parentGroups
}

/**
 * 全文搜索优化：使用数据库层面搜索
 * 建议后续考虑使用 Dexie 的全文搜索插件或建立关键词索引
 */
async function searchNotesInDatabase(keyword: string) {
  const { db } = useDexie()
  // 使用数据库层面的模糊搜索，比内存遍历更高效
  return await db.value.notes
    .filter(note =>
      note.item_type === NOTE_TYPE.NOTE
      && note.is_deleted !== 1
      && (note.content.includes(keyword) || note.title.includes(keyword)),
    )
    .toArray()
}

/**
 * 同步更新索引
 */
function updateIndexes(note: Note, operation: 'add' | 'update' | 'delete') {
  if (!note.id)
    return

  switch (operation) {
    case 'add':
    case 'update': {
      // 更新 ID 索引
      notesMap.value.set(note.id, note)

      // 更新父级索引
      const parentId = note.parent_id || 'root'
      if (!parentIdMap.value.has(parentId)) {
        parentIdMap.value.set(parentId, [])
      }

      // 移除旧的父级关系（如果存在）
      for (const [pid, noteList] of parentIdMap.value.entries()) {
        const index = noteList.findIndex(n => n.id === note.id)
        if (index > -1 && pid !== parentId) {
          noteList.splice(index, 1)
          if (noteList.length === 0) {
            parentIdMap.value.delete(pid)
          }
        }
      }

      // 添加新的父级关系
      const parentNotes = parentIdMap.value.get(parentId)!
      const existingIndex = parentNotes.findIndex(n => n.id === note.id)
      if (existingIndex > -1) {
        parentNotes[existingIndex] = note
      }
      else {
        parentNotes.push(note)
      }
      break
    }

    case 'delete': {
      // 从 ID 索引移除
      notesMap.value.delete(note.id)

      // 从父级索引移除
      for (const [pid, noteList] of parentIdMap.value.entries()) {
        const index = noteList.findIndex(n => n.id === note.id)
        if (index > -1) {
          noteList.splice(index, 1)
          if (noteList.length === 0) {
            parentIdMap.value.delete(pid)
          }
          break
        }
      }
      break
    }
  }
}

// 全局初始化函数
export async function initializeNotes() {
  if (!isInitialized && !initializing) {
    initializing = true
    try {
      const { db } = useDexie()
      const data = await db.value.notes
        .orderBy('created')
        .toArray()
      notes.value = data

      // 初始化后重建索引
      rebuildIndexMaps()

      // 初始化 useRefDBSync
      notesSync = useRefDBSync({
        data: notes,
        table: db.value.notes,
        idField: 'id',
        debounceMs: 300,
      })

      isInitialized = true
    }
    catch (error) {
      console.error('Error initializing notes:', error)
    }
    finally {
      initializing = false
    }
  }
}

// 导出同步控制函数
export function getNotesSync() {
  return notesSync
}

export function useNote() {
  const { db } = useDexie()
  const privateNoteUpdateArr: UpdateFn[] = []

  function getFirstNote() {
    const sortedNotes = notes.value.slice().sort((a, b) => (a.created || '').localeCompare(b.created || ''))
    return sortedNotes[0] || null
  }

  function fetchNotes() {
    return db.value.notes
      .orderBy('created') // 按 created 排序
      .toArray() // 将结果转换为数组
      .then((data: Note[]) => {
        notes.value = data
        // 重建索引
        rebuildIndexMaps()
      })
      .catch((error: any) => {
        console.error('Error fetching data:', error)
      })
  }

  function addNote(note: Note) {
    // 确保有 updated 字段用于同步检测
    const noteWithTime = Object.assign({}, note, {
      updated: note.updated || getTime(),
    })

    // 直接添加到 notes ref 变量
    notes.value.push(noteWithTime)
    // 按 created 重新排序
    notes.value.sort((a, b) => (a.created || '').localeCompare(b.created || ''))

    // 更新索引
    updateIndexes(noteWithTime, 'add')

    return noteWithTime
  }

  function getNote(id: string) {
    // 使用 Map 索引快速查找，时间复杂度从 O(n) 优化到 O(1)
    return notesMap.value.get(id) || null
  }

  function deleteNote(id: string) {
    // 先获取要删除的笔记用于更新索引
    const noteToDelete = notesMap.value.get(id)
    if (!noteToDelete)
      return

    // 从 notes ref 变量删除
    const index = notes.value.findIndex(n => n.id === id)
    if (index > -1) {
      notes.value.splice(index, 1)
      // 更新索引
      updateIndexes(noteToDelete, 'delete')
    }
  }

  function updateNote(id: string, updates: Partial<Note>) {
    // 使用 Map 索引快速查找
    const existingNote = notesMap.value.get(id)
    if (existingNote) {
      // 确保更新 updated 用于同步检测
      const updatedNote = Object.assign({}, existingNote, updates, { updated: updates.updated || getTime() })

      // 更新数组中的数据
      const noteIndex = notes.value.findIndex(n => n.id === id)
      if (noteIndex > -1) {
        notes.value[noteIndex] = updatedNote
        // 更新索引
        updateIndexes(updatedNote, 'update')
      }
    }
  }

  async function getAllFolders() {
    // 可以考虑为 item_type 也建立索引，但这里先保持简单的过滤
    return notes.value.filter(note => note.item_type === NOTE_TYPE.FOLDER && note.is_deleted !== 1)
  }

  async function getNotesByParentId(parent_id: string) {
    if (parent_id === 'allnotes') {
      return notes.value.filter(note => note.item_type === NOTE_TYPE.NOTE && note.is_deleted !== 1)
    }
    else if (parent_id === 'unfilednotes') {
      // 使用 Map 索引快速查找根级别的笔记
      const rootNotes = parentIdMap.value.get('root') || []
      return rootNotes.filter(note => note.item_type === NOTE_TYPE.NOTE && note.is_deleted !== 1)
    }
    else {
      // 使用 Map 索引快速查找，时间复杂度从 O(n) 优化到 O(1)
      const childNotes = parentIdMap.value.get(parent_id) || []
      return childNotes.filter(note => note.is_deleted !== 1)
    }
  }

  async function getDeletedNotes() {
    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().replace('T', ' ') // 30天前的ISO字符串
    return notes.value.filter(note => note.is_deleted === 1 && note.updated >= thirtyDaysAgo)
  }

  async function getNoteCountByParentId(parent_id: string) {
    // 使用 Map 索引快速获取子项目
    const categories = parentIdMap.value.get(parent_id) || []
    const validCategories = categories.filter(note => note.is_deleted !== 1)

    let count = 0

    // 遍历所有分类
    for (const category of validCategories) {
      // 如果是笔记类型，计数加1
      if (category.item_type === NOTE_TYPE.NOTE) {
        count++
      }
      // 如果是文件夹类型，递归获取其中的笔记数量
      else if (category.item_type === NOTE_TYPE.FOLDER) {
        count += category.note_count
      }
    }

    return count
  }

  function onUpdateNote(fn: UpdateFn) {
    onNoteUpdateArr.push(fn)
    privateNoteUpdateArr.push(fn)
  }

  function getNotesByUpdated(updated: string) {
    return notes.value.filter(note => note.updated > updated)
  }

  function getFolderTreeByParentId(parent_id: string | null = ''): FolderTreeNode[] {
    /**
     * 使用 Map 索引快速查找，先获取全部文件夹，再根据parent_id获取对应的文件夹，再递归寻找每个文件夹的子文件夹
     * 使用新的数据结构，不修改原始数据
     */
    const allFolders = notes.value.filter(note => note.item_type === NOTE_TYPE.FOLDER && note.is_deleted !== 1)

    // 使用 Map 索引快速查找子文件夹
    const mapKey = parent_id || 'root'
    const childItems = parentIdMap.value.get(mapKey) || []
    const folders = childItems.filter(item => item.item_type === NOTE_TYPE.FOLDER && item.is_deleted !== 1)

    if (folders && folders.length > 0) {
      // 递归构建文件夹树
      const buildFolderTree = (currentFolder: Note, allFolders: Note[]): FolderTreeNode => {
        // 创建一个新的树节点，引用原始数据
        const folderNode: FolderTreeNode = {
          children: [],
          originNote: currentFolder,
        }

        const childFolders = allFolders.filter(item => item.parent_id === currentFolder.id)

        if (childFolders.length > 0) {
          folderNode.children = childFolders.map(child => buildFolderTree(child, allFolders))
        }

        return folderNode
      }

      // 为每个顶层文件夹构建树结构
      return folders.map(folder => buildFolderTree(folder, allFolders))
    }
    return []
  }

  function getUnfiledNotesCount() {
    return notes.value.filter(note =>
      note.item_type === NOTE_TYPE.NOTE
      && note.parent_id === null
      && note.is_deleted !== 1,
    ).length
  }

  async function searchNotesByParentId(parent_id: string, title: string, keyword: string) {
    // 使用 Map 索引快速获取子项目
    const childItems = parentIdMap.value.get(parent_id) || []

    // 搜索当前 parent_id 下符合条件的笔记
    const directNotes = childItems
      .filter(note =>
        note.item_type === NOTE_TYPE.NOTE
        && note.is_deleted === 0
        && note.content.includes(keyword),
      )
      .map(note => Object.assign({}, note, {
        folderName: title,
      }))

    // 获取当前 parent_id 下的所有文件夹
    const folders = childItems.filter(note =>
      note.item_type === NOTE_TYPE.FOLDER
      && note.is_deleted === 0,
    )

    // 递归搜索每个文件夹中的笔记
    let allMatchedNotes = directNotes.slice()

    for (const folder of folders) {
      // 对每个文件夹递归调用搜索方法
      const folderNotes = await searchNotesByParentId(folder.id!, folder.title, keyword)
      allMatchedNotes = allMatchedNotes.concat(folderNotes)
    }

    return allMatchedNotes
  }

  /**
   * 递归更新父级数量统计 note_count 字段
   * @param note 当前Note
   * @returns void
   */
  async function updateParentFolderSubcount(note: Note) {
    if (!note || !note.parent_id) {
      return // 如果没有父级，直接返回
    }

    let currentParentId: string | null = note.parent_id

    // 递归更新所有父级文件夹的 noteCount
    while (currentParentId) {
      // 使用 Map 索引快速获取当前父级文件夹
      const parentFolder: Note | undefined = notesMap.value.get(currentParentId!)
      if (!parentFolder || parentFolder.item_type !== NOTE_TYPE.FOLDER) {
        break
      }

      // 计算当前文件夹下的笔记数量（递归计算）
      const noteCount = await getNoteCountByParentId(currentParentId)

      // 先获取当前文件夹信息，再更新父级文件夹的 note_count 和 updated
      const currentFolder = notesMap.value.get(currentParentId)
      if (currentFolder) {
        updateNote(currentParentId, {
          note_count: noteCount,
          updated: getTime(),
        })
      }

      // 继续向上查找父级
      currentParentId = parentFolder.parent_id
    }
  }

  onUnmounted(() => {
    privateNoteUpdateArr.forEach((fn) => {
      onNoteUpdateArr.splice(onNoteUpdateArr.indexOf(fn), 1)
    })
  })

  return {
    getFirstNote,
    notes,
    fetchNotes,
    addNote,
    getNote,
    deleteNote,
    updateNote,
    getNotesByParentId,
    getDeletedNotes,
    getNoteCountByParentId,
    getNotesByUpdated,
    onUpdateNote,
    searchNotesByParentId,
    // 文件夹
    getAllFolders,
    getFolderTreeByParentId,
    getUnfiledNotesCount,
    updateParentFolderSubcount,
    // 同步相关
    getNotesSync: () => notesSync,
    // 搜索优化
    searchNotesInDatabase,
  }
}
