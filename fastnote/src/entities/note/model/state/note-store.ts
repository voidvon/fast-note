import type { NoteSyncController } from '@/shared/lib/storage'
import type { FolderTreeNode, Note } from '@/shared/types'
import { onUnmounted, ref } from 'vue'
import { getTime } from '@/shared/lib/date'
import {
  createNotesSync,
  getCurrentDatabaseName,
  readStoredNotes,
  useDexie,
} from '@/shared/lib/storage'
import { normalizeNoteLockFields, NOTE_TYPE } from '@/shared/types'
import { buildFolderTree, countNotesWithinChildren, countUnfiledNotes } from '../domain/folder-tree'
import { isDeletedNoteRetained, matchesFolderKeyword, matchesNoteKeyword, shouldRefreshNoteUpdated } from '../domain/note-rules'
import { useNoteIndexState } from './note-index-state'

type UpdateFn = (item: Note) => void

const notes = ref<Note[]>([])
const { getIndexedNote, getIndexedNotesByParentId, rebuildNoteIndexes, updateNoteIndexes } = useNoteIndexState()
let initializing = false
let isInitialized = false
const onNoteUpdateArr: UpdateFn[] = []

// 全局同步实例
let notesSync: NoteSyncController | null = null
let initializedDatabaseName = ''

interface SearchNotesOptions {
  limit?: number
  parentId?: string
  rootTitle?: string
}

function resolveSearchRootTitle(parentId: string, rootTitle?: string) {
  if (rootTitle?.trim()) {
    return rootTitle.trim()
  }

  if (!parentId) {
    return '全部'
  }

  const parent = getIndexedNote(parentId)
  return parent?.title || '全部'
}

function collectMatchedNotes(
  parentId: string,
  keyword: string,
  currentFolderTitle: string,
  inheritedFolderMatch: boolean,
  results: Map<string, Note>,
) {
  const childItems = getIndexedNotesByParentId(parentId)

  for (const item of childItems) {
    if (item.is_deleted === 1) {
      continue
    }

    if (item.item_type === NOTE_TYPE.FOLDER) {
      const nextFolderMatch = inheritedFolderMatch || matchesFolderKeyword(item, keyword)
      collectMatchedNotes(item.id!, keyword, item.title, nextFolderMatch, results)
      continue
    }

    if (item.item_type !== NOTE_TYPE.NOTE) {
      continue
    }

    if (!inheritedFolderMatch && !matchesNoteKeyword(item, keyword)) {
      continue
    }

    results.set(item.id, {
      ...item,
      folderName: currentFolderTitle,
    })
  }
}

async function searchNotes(keyword: string, options: SearchNotesOptions = {}) {
  const normalizedKeyword = keyword.trim()
  if (!normalizedKeyword) {
    return []
  }

  const parentId = options.parentId || ''
  const currentFolderTitle = resolveSearchRootTitle(parentId, options.rootTitle)
  const parentNote = parentId ? getIndexedNote(parentId) : null
  const inheritedFolderMatch = !!parentNote
    && parentNote.item_type === NOTE_TYPE.FOLDER
    && matchesFolderKeyword(parentNote, normalizedKeyword)
  const results = new Map<string, Note>()

  collectMatchedNotes(parentId, normalizedKeyword, currentFolderTitle, inheritedFolderMatch, results)

  const matchedNotes = [...results.values()]
  if (typeof options.limit === 'number' && options.limit > 0) {
    return matchedNotes.slice(0, options.limit)
  }

  return matchedNotes
}

function resetNotesState() {
  if (notesSync) {
    notesSync.stopAutoSync()
    notesSync = null
  }

  notes.value = []
  rebuildNoteIndexes(notes.value)
  isInitialized = false
}

export async function initializeNotes() {
  const nextDatabaseName = getCurrentDatabaseName()

  if (!nextDatabaseName)
    throw new Error('数据库未初始化')

  if (isInitialized && initializedDatabaseName === nextDatabaseName)
    return

  if (initializing)
    return

  initializing = true
  try {
    resetNotesState()

    const { db } = useDexie()
    if (!db.value) {
      throw new Error('数据库未初始化')
    }

    const data = await readStoredNotes(db.value)
    notes.value = data.map(note => normalizeNoteLockFields(note))
    rebuildNoteIndexes(notes.value)

    notesSync = createNotesSync(notes, db.value)

    initializedDatabaseName = nextDatabaseName
    isInitialized = true
  }
  catch (error) {
    console.error('Error initializing notes:', error)
  }
  finally {
    initializing = false
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
    return readStoredNotes(db.value)
      .then((data: Note[]) => {
        notes.value = data.map(note => normalizeNoteLockFields(note))
        rebuildNoteIndexes(notes.value)
      })
      .catch((error: any) => {
        console.error('Error fetching data:', error)
      })
  }

  function addNote(note: Note) {
    // 确保有 updated 字段用于同步检测
    const noteWithTime = normalizeNoteLockFields(Object.assign({}, note, {
      updated: note.updated || getTime(),
    }))

    // 直接添加到 notes ref 变量
    notes.value.push(noteWithTime)
    // 按 created 重新排序
    notes.value.sort((a, b) => (a.created || '').localeCompare(b.created || ''))

    // 更新索引
    updateNoteIndexes(noteWithTime, 'add')

    return noteWithTime
  }

  function getNote(id: string) {
    // 使用 Map 索引快速查找，时间复杂度从 O(n) 优化到 O(1)
    return getIndexedNote(id)
  }

  function deleteNote(id: string) {
    // 先获取要删除的笔记用于更新索引
    const noteToDelete = getIndexedNote(id)
    if (!noteToDelete)
      return

    // 从 notes ref 变量删除
    const index = notes.value.findIndex(n => n.id === id)
    if (index > -1) {
      notes.value.splice(index, 1)
      // 更新索引
      updateNoteIndexes(noteToDelete, 'delete')
    }
  }

  function updateNote(id: string, updates: Partial<Note>) {
    // 使用 Map 索引快速查找
    const existingNote = getIndexedNote(id)
    if (existingNote) {
      const nextUpdated = shouldRefreshNoteUpdated(existingNote, updates)
        ? getTime()
        : updates.updated

      // 确保更新 updated 用于同步检测
      const updatedNote = normalizeNoteLockFields(Object.assign({}, existingNote, updates, { updated: nextUpdated }))

      // 更新数组中的数据 - 使用 splice 确保触发响应式更新
      const noteIndex = notes.value.findIndex(n => n.id === id)
      if (noteIndex > -1) {
        notes.value.splice(noteIndex, 1, updatedNote)
        // 更新索引
        updateNoteIndexes(updatedNote, 'update')
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
      const rootNotes = getIndexedNotesByParentId('')
      return rootNotes.filter(note => note.item_type === NOTE_TYPE.NOTE && note.is_deleted !== 1)
    }
    else {
      const childNotes = getIndexedNotesByParentId(parent_id)
      return childNotes.filter(note => note.is_deleted !== 1)
    }
  }

  function getNoteDescendants(noteId: string) {
    const descendants: Note[] = []
    const queue = [noteId]

    while (queue.length > 0) {
      const parentId = queue.shift()!
      const childNotes = getIndexedNotesByParentId(parentId)

      for (const childNote of childNotes) {
        descendants.push(childNote)
        if (childNote.item_type === NOTE_TYPE.FOLDER && childNote.id) {
          queue.push(childNote.id)
        }
      }
    }

    return descendants
  }

  function getDeletedAncestorChain(note: Note) {
    const ancestors: Note[] = []
    let currentParentId = note.parent_id

    while (currentParentId) {
      const parentNote = getIndexedNote(currentParentId)
      if (!parentNote) {
        break
      }

      if (parentNote.is_deleted === 1) {
        ancestors.push(parentNote)
      }
      currentParentId = parentNote.parent_id
    }

    return ancestors
  }

  /**
   * 统一处理 note / folder 的软删除与恢复。
   * 删除时会递归标记当前节点及所有未删除后代；
   * 恢复时会补回祖先路径，但只恢复同一批次软删的后代，避免误恢复更早独立删除的数据。
   */
  async function setNoteDeletedState(note: Note, isDeleted: 0 | 1) {
    if (!note?.id) {
      return note
    }

    const currentNote = getIndexedNote(note.id) || note
    const targetNotes = new Map<string, Note>()

    if (isDeleted === 0) {
      const deletedAncestors = getDeletedAncestorChain(currentNote)
      deletedAncestors.reverse().forEach((ancestor) => {
        targetNotes.set(ancestor.id, ancestor)
      })
    }

    targetNotes.set(currentNote.id, currentNote)

    const descendants = getNoteDescendants(currentNote.id)
    for (const descendant of descendants) {
      if (isDeleted === 1) {
        if (descendant.is_deleted !== 1) {
          targetNotes.set(descendant.id, descendant)
        }
        continue
      }

      if (descendant.is_deleted === 1 && descendant.updated === currentNote.updated) {
        targetNotes.set(descendant.id, descendant)
      }
    }

    const nextUpdated = getTime()
    for (const targetNote of targetNotes.values()) {
      updateNote(targetNote.id, {
        is_deleted: isDeleted,
        updated: nextUpdated,
      })
    }

    await updateParentFolderSubcount(currentNote)

    return getIndexedNote(currentNote.id) || currentNote
  }

  async function getDeletedNotes() {
    return notes.value.filter(note => isDeletedNoteRetained(note))
  }

  async function getNoteCountByParentId(parent_id: string) {
    // 使用 Map 索引快速获取子项目
    const categories = getIndexedNotesByParentId(parent_id)
    return countNotesWithinChildren(categories)
  }

  function onUpdateNote(fn: UpdateFn) {
    onNoteUpdateArr.push(fn)
    privateNoteUpdateArr.push(fn)
  }

  function getNotesByUpdated(updated: string) {
    return notes.value.filter(note => note.updated > updated)
  }

  function getFolderTreeByParentId(parent_id: string = ''): FolderTreeNode[] {
    return buildFolderTree(notes.value, parent_id)
  }

  function getUnfiledNotesCount() {
    return countUnfiledNotes(notes.value)
  }

  async function searchNotesByParentId(parent_id: string, title: string, keyword: string) {
    return await searchNotes(keyword, {
      parentId: parent_id,
      rootTitle: title,
    })
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
      const parentFolder = getIndexedNote(currentParentId!)
      if (!parentFolder || parentFolder.item_type !== NOTE_TYPE.FOLDER) {
        break
      }

      // 计算当前文件夹下的笔记数量（递归计算）
      const noteCount = await getNoteCountByParentId(currentParentId)

      // 先获取当前文件夹信息，再更新父级文件夹的 note_count 和 updated
      const currentFolder = getIndexedNote(currentParentId)
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
    setNoteDeletedState,
    getNoteCountByParentId,
    getNotesByUpdated,
    onUpdateNote,
    searchNotes,
    searchNotesByParentId,
    // 文件夹
    getAllFolders,
    getFolderTreeByParentId,
    getUnfiledNotesCount,
    updateParentFolderSubcount,
    // 同步相关
    getNotesSync: () => notesSync,
  }
}
