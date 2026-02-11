import type { Table } from 'dexie'
import type { FolderTreeNode, Note } from '@/types'
import Dexie from 'dexie'
import { ref } from 'vue'
import { useRefDBSync } from '@/database'
import { NOTE_TYPE } from '@/types'
import { getTime } from '@/utils/date'

// 用户数据库类
class UserPublicNotesDB extends Dexie {
  notes!: Table<Note>

  constructor(username: string) {
    super(`UserPublicNotes_${username}`)

    this.version(1).stores({
      notes: '&id, [item_type+parent_id+is_deleted], title, created, item_type, parent_id, content, updated, version, is_deleted, note_count',
    })
  }
}

// 全局状态管理 - 每个用户一个独立的状态
const userPublicNotesMap = new Map<string, {
  db: UserPublicNotesDB
  publicNotes: ReturnType<typeof ref<Note[]>>
  initializing: boolean
  isInitialized: boolean
  publicNotesSync: ReturnType<typeof useRefDBSync<Note>> | null
}>()

// 获取或创建用户状态
function getUserState(username: string) {
  if (!userPublicNotesMap.has(username)) {
    userPublicNotesMap.set(username, {
      db: new UserPublicNotesDB(username),
      publicNotes: ref<Note[]>([]),
      initializing: false,
      isInitialized: false,
      publicNotesSync: null,
    })
  }
  return userPublicNotesMap.get(username)!
}

// 全局初始化函数
export async function initializeUserPublicNotes(username: string) {
  const state = getUserState(username)

  if (!state.isInitialized && !state.initializing) {
    state.initializing = true
    try {
      // 打开用户专用数据库
      await state.db.open()

      // 从数据库读取数据
      const data = await state.db.notes
        .orderBy('created')
        .toArray()
      state.publicNotes.value = data

      // 初始化 useRefDBSync
      state.publicNotesSync = useRefDBSync({
        data: state.publicNotes as any,
        table: state.db.notes,
        idField: 'id',
        debounceMs: 300,
      })

      state.isInitialized = true
    }
    catch (error) {
      console.error('Error initializing user public notes:', error)
    }
    finally {
      state.initializing = false
    }
  }
}

// 导出同步控制函数
export function getUserPublicNotesSync(username: string) {
  const state = getUserState(username)
  return state.publicNotesSync
}

export function useUserPublicNotes(username: string) {
  const state = getUserState(username)

  function getFirstPublicNote() {
    const publicNotes = state.publicNotes.value || []
    const sortedNotes = [...publicNotes].sort((a, b) => (a.created || '').localeCompare(b.created || ''))
    return sortedNotes[0] || null
  }

  function addPublicNote(note: Note) {
    // 确保有 lastdotime 字段用于同步检测
    const noteWithTime = {
      ...note,
      updated: note.updated || getTime(),
    }

    // 直接添加到 publicNotes ref 变量
    if (!state.publicNotes.value) {
      state.publicNotes.value = []
    }
    state.publicNotes.value.push(noteWithTime)
    // 按 created 重新排序
    state.publicNotes.value.sort((a, b) => (a.created || '').localeCompare(b.created || ''))
    return noteWithTime
  }

  function getPublicNote(id: string) {
    // 直接从 publicNotes ref 变量获取
    const publicNotes = state.publicNotes.value || []
    const note = publicNotes.find(n => n.id === id)
    return note || null
  }

  function deletePublicNote(id: string) {
    // 直接从 publicNotes ref 变量删除
    if (!state.publicNotes.value)
      return
    const index = state.publicNotes.value.findIndex(n => n.id === id)
    if (index > -1) {
      state.publicNotes.value.splice(index, 1)
    }
  }

  function updatePublicNote(id: string, updates: any) {
    // 直接更新 publicNotes ref 变量中的数据
    if (!state.publicNotes.value)
      return
    const noteIndex = state.publicNotes.value.findIndex(n => n.id === id)
    if (noteIndex > -1) {
      // 确保更新 lastdotime 用于同步检测
      const updatedNote = {
        ...state.publicNotes.value[noteIndex],
        ...updates,
        updated: updates.updated || getTime(),
      }
      state.publicNotes.value[noteIndex] = updatedNote
    }
  }

  async function getAllPublicFolders() {
    const publicNotes = state.publicNotes.value || []
    return publicNotes.filter(note => note.item_type === NOTE_TYPE.FOLDER && note.is_deleted !== 1)
  }

  async function getPublicNotesByPUuid(parent_id: string) {
    const publicNotes = state.publicNotes.value || []
    if (parent_id === 'allnotes') {
      return publicNotes.filter(note => note.item_type === NOTE_TYPE.NOTE && note.is_deleted !== 1)
    }
    else if (parent_id === 'unfilednotes') {
      return publicNotes.filter(note => note.item_type === NOTE_TYPE.NOTE && note.parent_id === null && note.is_deleted !== 1)
    }
    else {
      return publicNotes.filter(note => note.parent_id === parent_id && note.is_deleted !== 1)
    }
  }

  async function getDeletedPublicNotes() {
    const publicNotes = state.publicNotes.value || []
    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().replace('T', ' ') // 30天前的ISO字符串
    return publicNotes.filter(note => note.is_deleted === 1 && note.updated >= thirtyDaysAgo)
  }

  async function getPublicNoteCountByUuid(parent_id: string) {
    const publicNotes = state.publicNotes.value || []
    // 获取当前 parent_id 下的所有分类
    const categories = publicNotes.filter(note => note.parent_id === parent_id && note.is_deleted !== 1)

    let count = 0

    // 遍历所有分类
    for (const category of categories) {
      // 如果是笔记类型，计数加1
      if (category.item_type === NOTE_TYPE.NOTE) {
        count++
      }
      // 如果是文件夹类型，递归获取其中的笔记数量
      else if (category.item_type === NOTE_TYPE.FOLDER) {
        count += category.note_count || 0
      }
    }

    return count
  }

  function getPublicNotesByUpdated(updated: string) {
    const publicNotes = state.publicNotes.value || []
    return publicNotes.filter(note => note.updated > updated)
  }

  function getPublicFolderTreeByPUuid(parent_id: string | null = ''): FolderTreeNode[] {
    /**
     * 先获取全部文件夹，再根据parent_id获取对应的文件夹，再递归寻找每个文件夹的子文件夹
     * 使用新的数据结构，不修改原始数据
     */
    const publicNotes = state.publicNotes.value || []
    const allFolders = publicNotes.filter(note => note.item_type === NOTE_TYPE.FOLDER && note.is_deleted !== 1)
    const folders = allFolders.filter(item => item.parent_id === parent_id)

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

  function getUnfiledPublicNotesCount() {
    const publicNotes = state.publicNotes.value || []
    return publicNotes.filter(note =>
      note.item_type === NOTE_TYPE.NOTE
      && note.parent_id === null
      && note.is_deleted !== 1,
    ).length
  }

  async function searchPublicNotesByPUuid(parent_id: string, title: string, keyword: string) {
    const publicNotes = state.publicNotes.value || []
    // 搜索当前 parent_id 下符合条件的笔记
    const directNotes = publicNotes
      .filter(note =>
        note.item_type === NOTE_TYPE.NOTE
        && note.parent_id === parent_id
        && note.is_deleted === 0
        && note.content.includes(keyword),
      )
      .map(note => ({
        ...note,
        folderName: title,
      }))

    // 获取当前 parent_id 下的所有文件夹
    const folders = publicNotes.filter(note =>
      note.item_type === NOTE_TYPE.FOLDER
      && note.parent_id === parent_id
      && note.is_deleted === 0,
    )

    // 递归搜索每个文件夹中的笔记
    let allMatchedNotes = [...directNotes]

    for (const folder of folders) {
      // 对每个文件夹递归调用搜索方法
      const folderNotes = await searchPublicNotesByPUuid(folder.id!, folder.title, keyword)
      allMatchedNotes = [...allMatchedNotes, ...folderNotes]
    }

    return allMatchedNotes
  }

  /**
   * 递归更新父级数量统计 subcount 字段
   * @param note 当前Note
   * @returns void
   */
  async function updateParentPublicFolderSubcount(note: Note) {
    if (!note || !note.parent_id) {
      return // 如果没有父级，直接返回
    }

    let currentPuuid: string | null = note.parent_id

    // 递归更新所有父级文件夹的 noteCount
    while (currentPuuid) {
      const publicNotes = state.publicNotes.value || []
      // 获取当前父级文件夹
      const parentFolder: Note | undefined = publicNotes.find(note => note.id === currentPuuid)
      if (!parentFolder || parentFolder.item_type !== NOTE_TYPE.FOLDER) {
        break
      }

      // 计算当前文件夹下的笔记数量（递归计算）
      const noteCount = await getPublicNoteCountByUuid(currentPuuid)

      // 先获取当前文件夹信息，再更新父级文件夹的 subcount 和 lastdotime
      const currentFolder = publicNotes.find(note => note.id === currentPuuid)
      if (currentFolder) {
        updatePublicNote(currentPuuid, {
          note_count: noteCount,
          updated: getTime(),
        })
      }

      // 继续向上查找父级
      currentPuuid = parentFolder.parent_id
    }
  }

  return {
    getFirstPublicNote,
    publicNotes: state.publicNotes,
    addPublicNote,
    getPublicNote,
    deletePublicNote,
    updatePublicNote,
    getPublicNotesByPUuid,
    getDeletedPublicNotes,
    getPublicNoteCountByUuid,
    searchPublicNotesByPUuid,
    // 文件夹
    getAllPublicFolders,
    getPublicFolderTreeByPUuid,
    getUnfiledPublicNotesCount,
    updateParentPublicFolderSubcount,
    // 同步相关
    getUserPublicNotesSync: () => state.publicNotesSync,
  }
}
