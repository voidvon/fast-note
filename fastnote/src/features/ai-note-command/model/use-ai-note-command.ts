import type { Ref } from 'vue'
import type {
  AiCreateNotePayload,
  AiFolderListItem,
  AiNoteDetailItem,
  AiNoteSearchItem,
  AiNoteToolCall,
  AiToolPreview,
  AiToolResult,
  AiUpdateNotePayload,
  FolderTreeNode,
  Note,
} from '@/shared/types'
import { NOTE_TYPE, useNote } from '@/entities/note'
import { useNoteDelete } from '@/features/note-delete'
import { useNoteLock } from '@/features/note-lock'
import { useNoteMove } from '@/features/note-move'
import { useNoteWrite } from '@/features/note-write'
import { useSync } from '@/processes/sync-notes'

type MaybePromise<T> = T | Promise<T>

interface MoveNoteOutcome {
  code?: string
  message?: string | null
  moved: boolean
  note: Note | null | undefined
}

interface DeleteNoteOutcome {
  ok: boolean
  note: Note
}

interface LockNoteOutcome {
  ok: boolean
  code: string
  message: string | null
  note?: Note
}

export interface UseAiNoteCommandOptions {
  createNote?: ReturnType<typeof useNoteWrite>['createNote']
  deleteNote?: (note: Note) => MaybePromise<DeleteNoteOutcome>
  disableLockForNote?: (noteId: string) => MaybePromise<LockNoteOutcome>
  enableLockForNote?: (noteId: string, options?: { biometricEnabled?: boolean }) => MaybePromise<LockNoteOutcome>
  getFolderTreeByParentId?: (parentId?: string) => FolderTreeNode[]
  getNote?: (id: string) => MaybePromise<Note | null | undefined>
  moveNote?: (noteId: string, targetFolderId: string) => MaybePromise<MoveNoteOutcome>
  notes?: Ref<Note[]>
  searchNotesInDatabase?: (query: string) => MaybePromise<Note[]>
  sync?: (silent?: boolean) => MaybePromise<unknown>
  updateNote?: ReturnType<typeof useNoteWrite>['updateNote']
}

function flattenFolderTree(nodes: FolderTreeNode[], result: AiFolderListItem[] = []) {
  for (const node of nodes) {
    result.push({
      id: node.originNote.id,
      title: node.originNote.title,
      parentId: node.originNote.parent_id,
      noteCount: node.originNote.note_count,
    })
    flattenFolderTree(node.children, result)
  }

  return result
}

function toSearchItem(note: Note): AiNoteSearchItem {
  return {
    id: note.id,
    title: note.title,
    summary: note.summary,
    parentId: note.parent_id,
    updated: note.updated,
    isLocked: note.is_locked === 1,
    isDeleted: note.is_deleted === 1,
  }
}

function appendHtml(baseContent: string, appendedContent: string) {
  if (!baseContent) {
    return appendedContent
  }

  return `${baseContent}${appendedContent}`
}

function isMutationTool(tool: AiNoteToolCall['tool']) {
  return tool === 'create_note'
    || tool === 'update_note'
    || tool === 'move_note'
    || tool === 'delete_note'
    || tool === 'set_note_lock'
}

function shouldRequireConfirmation(call: AiNoteToolCall) {
  if (typeof call.requireConfirmation === 'boolean') {
    return call.requireConfirmation
  }

  return call.tool === 'move_note'
    || call.tool === 'delete_note'
    || call.tool === 'set_note_lock'
}

function buildPreview(call: AiNoteToolCall): AiToolPreview {
  switch (call.tool) {
    case 'create_note':
      return {
        title: '准备创建备忘录',
        summary: `将在目录 ${call.payload.parentId || '根目录'} 下创建${call.payload.kind === 'folder' ? '文件夹' : '备忘录'}“${call.payload.title || '未命名'}”`,
        affectedNoteIds: call.payload.noteId ? [call.payload.noteId] : [],
      }
    case 'update_note':
      return {
        title: '准备更新备忘录',
        summary: `将更新备忘录 ${call.payload.noteId} 的标题、内容或目录信息`,
        affectedNoteIds: [call.payload.noteId],
      }
    case 'move_note':
      return {
        title: '准备移动备忘录',
        summary: `将备忘录 ${call.payload.noteId} 移动到目录 ${call.payload.targetFolderId}`,
        affectedNoteIds: [call.payload.noteId],
      }
    case 'delete_note':
      return {
        title: '准备删除备忘录',
        summary: `将软删除备忘录 ${call.payload.noteId}`,
        affectedNoteIds: [call.payload.noteId],
      }
    case 'set_note_lock':
      return {
        title: call.payload.action === 'enable' ? '准备开启备忘录锁' : '准备关闭备忘录锁',
        summary: `${call.payload.action === 'enable' ? '开启' : '关闭'}备忘录 ${call.payload.noteId} 的锁定状态`,
        affectedNoteIds: [call.payload.noteId],
      }
    case 'get_note_detail':
      return {
        title: '读取备忘录详情',
        summary: `读取备忘录 ${call.payload.noteId} 的详情`,
        affectedNoteIds: [call.payload.noteId],
      }
    case 'list_folders':
      return {
        title: '读取文件夹列表',
        summary: `读取目录 ${call.payload.parentId || '根目录'} 下的文件夹树`,
        affectedNoteIds: [],
      }
    case 'search_notes':
      return {
        title: '搜索备忘录',
        summary: `搜索关键字“${call.payload.query}”`,
        affectedNoteIds: [],
      }
  }
}

export function useAiNoteCommand(options: UseAiNoteCommandOptions = {}) {
  const noteStore = options.getNote && options.searchNotesInDatabase && options.getFolderTreeByParentId && options.notes
    ? null
    : useNote()
  const noteMoveApi = options.moveNote ? null : useNoteMove()
  const noteDeleteApi = options.deleteNote ? null : useNoteDelete()
  const noteLockApi = options.enableLockForNote && options.disableLockForNote ? null : useNoteLock()
  const noteWriteApi = options.createNote && options.updateNote
    ? null
    : useNoteWrite({
        addNote: noteStore!.addNote,
        getNote: noteStore!.getNote,
        updateNote: noteStore!.updateNote,
        updateParentFolderSubcount: noteStore!.updateParentFolderSubcount,
      })
  const syncApi = options.sync ? null : useSync()

  const getNote = options.getNote || noteStore!.getNote
  const notes = options.notes || noteStore!.notes
  const searchNotesInDatabase = options.searchNotesInDatabase || noteStore!.searchNotesInDatabase
  const getFolderTreeByParentId = options.getFolderTreeByParentId || noteStore!.getFolderTreeByParentId
  const createNote = options.createNote || noteWriteApi!.createNote
  const updateNote = options.updateNote || noteWriteApi!.updateNote
  const moveNote = options.moveNote || noteMoveApi!.moveNote
  const deleteNote = options.deleteNote || noteDeleteApi!.deleteNote
  const enableLockForNote = options.enableLockForNote || noteLockApi!.enableLockForNote
  const disableLockForNote = options.disableLockForNote || noteLockApi!.disableLockForNote
  const sync = options.sync || syncApi!.sync

  async function queueSyncIfNeeded(call: AiNoteToolCall, ok: boolean) {
    if (!ok || !isMutationTool(call.tool) || call.dryRun) {
      return false
    }

    try {
      await sync(true)
      return true
    }
    catch {
      return false
    }
  }

  async function executeCreateNote(payload: AiCreateNotePayload): Promise<AiToolResult<AiNoteDetailItem>> {
    const result = await createNote({
      noteId: payload.noteId,
      title: payload.title,
      summary: payload.summary,
      content: payload.contentHtml,
      parentId: payload.parentId,
      itemType: payload.kind === 'folder' ? NOTE_TYPE.FOLDER : NOTE_TYPE.NOTE,
    })

    return {
      ok: result.ok,
      code: result.code,
      message: result.message,
      data: result.note ? { note: result.note } : undefined,
      affectedNoteIds: result.note ? [result.note.id] : [],
    }
  }

  async function executeUpdateNote(payload: AiUpdateNotePayload): Promise<AiToolResult<AiNoteDetailItem>> {
    const currentNote = await getNote(payload.noteId)
    if (!currentNote) {
      return {
        ok: false,
        code: 'note_not_found',
        message: '当前备忘录不存在',
        affectedNoteIds: [payload.noteId],
      }
    }

    const nextContent = payload.contentHtml ?? (
      payload.appendContentHtml
        ? appendHtml(currentNote.content || '', payload.appendContentHtml)
        : currentNote.content
    )
    const result = await updateNote({
      noteId: payload.noteId,
      title: payload.title,
      summary: payload.summary,
      content: nextContent,
      parentId: payload.parentId,
      expectedUpdated: payload.expectedUpdated,
    })

    return {
      ok: result.ok,
      code: result.code,
      message: result.message,
      data: result.note ? { note: result.note } : undefined,
      affectedNoteIds: [payload.noteId],
    }
  }

  async function executeToolCall(call: AiNoteToolCall): Promise<AiToolResult> {
    const preview = buildPreview(call)
    if (call.dryRun || (shouldRequireConfirmation(call) && !call.confirmed)) {
      return {
        ok: true,
        code: call.dryRun ? 'dry_run' : 'confirmation_required',
        message: null,
        preview,
        requiresConfirmation: !call.dryRun && shouldRequireConfirmation(call),
        affectedNoteIds: preview.affectedNoteIds,
      }
    }

    let result: AiToolResult

    switch (call.tool) {
      case 'search_notes': {
        const query = call.payload.query.trim()
        if (!query) {
          result = {
            ok: false,
            code: 'invalid_query',
            message: '搜索关键字不能为空',
          }
          break
        }

        const matchedNotes = await searchNotesInDatabase(query)
        const filteredNotes = matchedNotes
          .filter(note => call.payload.includeDeleted || note.is_deleted !== 1)
          .filter(note => !call.payload.folderId || note.parent_id === call.payload.folderId)
          .slice(0, call.payload.limit || 20)
          .map(toSearchItem)

        result = {
          ok: true,
          code: 'ok',
          message: null,
          data: filteredNotes,
        }
        break
      }
      case 'get_note_detail': {
        const note = await getNote(call.payload.noteId)
        result = note
          ? {
              ok: true,
              code: 'ok',
              message: null,
              data: { note },
              affectedNoteIds: [note.id],
            }
          : {
              ok: false,
              code: 'note_not_found',
              message: '当前备忘录不存在',
              affectedNoteIds: [call.payload.noteId],
            }
        break
      }
      case 'list_folders': {
        result = {
          ok: true,
          code: 'ok',
          message: null,
          data: flattenFolderTree(getFolderTreeByParentId(call.payload.parentId || '')),
        }
        break
      }
      case 'create_note': {
        result = await executeCreateNote(call.payload)
        break
      }
      case 'update_note': {
        result = await executeUpdateNote(call.payload)
        break
      }
      case 'move_note': {
        const moveResult = await moveNote(call.payload.noteId, call.payload.targetFolderId)
        result = {
          ok: moveResult.moved,
          code: moveResult.code || (moveResult.moved ? 'ok' : 'move_failed'),
          message: moveResult.message || null,
          data: moveResult.note ? { note: moveResult.note } : undefined,
          affectedNoteIds: [call.payload.noteId],
        }
        break
      }
      case 'delete_note': {
        const note = await getNote(call.payload.noteId)
        if (!note) {
          result = {
            ok: false,
            code: 'note_not_found',
            message: '当前备忘录不存在',
            affectedNoteIds: [call.payload.noteId],
          }
          break
        }

        const deleteResult = await deleteNote(note)
        result = {
          ok: deleteResult.ok,
          code: deleteResult.ok ? 'ok' : 'delete_failed',
          message: deleteResult.ok ? null : '删除失败，请重试',
          data: { note: deleteResult.note },
          affectedNoteIds: [call.payload.noteId],
        }
        break
      }
      case 'set_note_lock': {
        const lockResult = call.payload.action === 'enable'
          ? await enableLockForNote(call.payload.noteId, {
              biometricEnabled: call.payload.biometricEnabled,
            })
          : await disableLockForNote(call.payload.noteId)

        result = {
          ok: lockResult.ok,
          code: lockResult.code,
          message: lockResult.message,
          data: lockResult.note ? { note: lockResult.note } : undefined,
          affectedNoteIds: [call.payload.noteId],
          humanActionRequired: lockResult.code === 'pin_required',
        }
        break
      }
    }

    result.preview = preview
    result.syncQueued = await queueSyncIfNeeded(call, result.ok)
    return result
  }

  async function executeToolCalls(calls: AiNoteToolCall[]) {
    const results: AiToolResult[] = []

    for (const call of calls) {
      results.push(await executeToolCall(call))
    }

    return results
  }

  return {
    buildPreview,
    executeToolCall,
    executeToolCalls,
    notes,
  }
}
