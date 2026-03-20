import type { Note } from '@/shared/types'
import { ref } from 'vue'
import { useNoteWrite } from '@/features/note-write'
import { NOTE_TYPE } from '@/shared/types'

type MaybePromise<T> = T | Promise<T>

export type LeaveFlushReason = 'view-leave' | 'pagehide' | 'beforeunload'

export interface SaveTargetContext {
  noteId?: string | null
  wasNewNote?: boolean
}

export interface NoteSaveEditor {
  getContent: () => string
  getTitle: () => {
    title: string
    summary: string
  }
  isMeaningfulContent?: () => boolean
}

export interface SaveNotePayload {
  noteId: string
  isNew: boolean
}

export interface SaveNoteParams {
  editor: NoteSaveEditor | null | undefined
  effectiveUuid: string | null
  isNewNote: boolean
  isDesktop: boolean
  parentId?: string
  routeParentId?: unknown
  isFormatModalOpen?: boolean
  isMissingPrivateNote?: boolean
  leaveFlushReason?: LeaveFlushReason | null
  saveTargetContext?: SaveTargetContext
  silent?: boolean
}

export interface UseNoteSaveOptions {
  addNote: (note: Note) => MaybePromise<unknown>
  getNote: (id: string) => MaybePromise<Note | null | undefined>
  updateNote: (id: string, note: Note) => MaybePromise<unknown>
  updateParentFolderSubcount: (note: Note) => MaybePromise<unknown>
  sync: (silent?: boolean) => MaybePromise<unknown>
  restoreHeight: () => void
  presentTopError: (message: string) => MaybePromise<void>
  flushNotesToLocal?: (reason: LeaveFlushReason) => MaybePromise<void>
  emitNoteSaved?: (payload: SaveNotePayload) => void
  getCurrentNote?: () => Note | null | undefined
  setCurrentNote?: (note: Note | null) => void
  setMissingPrivateNote?: (value: boolean) => void
  onMissingPrivateNote?: () => void
  onRouteDraftCreated?: (noteId: string) => void
  getNow?: () => string
}

function resolveParentId(isDesktop: boolean, parentId?: string, routeParentId?: unknown) {
  if (isDesktop) {
    return parentId || ''
  }

  if (typeof routeParentId !== 'string' || !routeParentId || routeParentId === 'unfilednotes') {
    return ''
  }

  return routeParentId
}

export function useNoteSave(options: UseNoteSaveOptions) {
  const isSaving = ref(false)
  const lastSavedContent = ref('')
  const noteWrite = useNoteWrite({
    addNote: options.addNote,
    getNote: options.getNote,
    updateNote: (id, updates) => options.updateNote(id, updates as Note),
    updateParentFolderSubcount: options.updateParentFolderSubcount,
    getNow: options.getNow,
  })

  async function flushNotesToLocalIfNeeded(reason?: LeaveFlushReason | null) {
    if (!reason) {
      return
    }

    await options.flushNotesToLocal?.(reason)
  }

  async function saveNote(params: SaveNoteParams) {
    if (params.isFormatModalOpen || !params.editor) {
      return
    }

    const content = params.editor.getContent() || ''
    const hasMeaningfulContent = params.editor.isMeaningfulContent?.() ?? !!content
    let { title, summary } = params.editor.getTitle()
    const noteId = params.saveTargetContext?.noteId ?? params.effectiveUuid
    const wasNewNote = params.saveTargetContext?.wasNewNote ?? params.isNewNote

    if (!noteId) {
      return
    }

    const noteExists = await options.getNote(noteId)

    if (wasNewNote && !noteExists && !hasMeaningfulContent) {
      await flushNotesToLocalIfNeeded(params.leaveFlushReason)
      return
    }

    if (content === lastSavedContent.value) {
      await flushNotesToLocalIfNeeded(params.leaveFlushReason)
      return
    }

    if (params.isMissingPrivateNote) {
      await flushNotesToLocalIfNeeded(params.leaveFlushReason)
      if (!params.silent) {
        await options.presentTopError('当前备忘录不存在或尚未同步完成')
      }
      return
    }

    if (!title || title.trim() === '') {
      title = '新建备忘录'
    }

    if (!params.silent) {
      isSaving.value = true
    }

    options.restoreHeight()

    const fileHashes: string[] = []

    try {
      if (noteExists) {
        const updateResult = await noteWrite.updateNote({
          noteId,
          title,
          summary,
          content,
          files: fileHashes,
        })
        if (!updateResult.ok || !updateResult.note) {
          throw new Error(updateResult.message || '更新备忘录失败')
        }

        options.setCurrentNote?.(updateResult.note)

        if (!params.silent) {
          options.emitNoteSaved?.({
            noteId,
            isNew: false,
          })
        }
      }
      else {
        if (!wasNewNote) {
          options.setMissingPrivateNote?.(true)
          options.setCurrentNote?.(null)
          options.onMissingPrivateNote?.()

          if (!params.silent) {
            await options.presentTopError('当前备忘录不存在或尚未同步完成')
          }
          return
        }

        const createResult = await noteWrite.createNote({
          noteId,
          title,
          summary,
          content,
          parentId: resolveParentId(params.isDesktop, params.parentId, params.routeParentId),
          itemType: NOTE_TYPE.NOTE,
          files: fileHashes,
        })
        if (!createResult.ok || !createResult.note) {
          throw new Error(createResult.message || '创建备忘录失败')
        }

        options.setCurrentNote?.(createResult.note)
        options.onRouteDraftCreated?.(noteId)
        options.emitNoteSaved?.({
          noteId,
          isNew: true,
        })
      }

      lastSavedContent.value = content
      await flushNotesToLocalIfNeeded(params.leaveFlushReason)

      if (!params.silent) {
        try {
          await options.sync(true)
        }
        catch (error) {
          console.error('自动同步失败:', error)
          await options.presentTopError('同步失败，请检查网络连接')
        }
      }
    }
    catch (error) {
      console.error('保存笔记失败:', error)
      await options.presentTopError('保存失败，请重试')
    }
    finally {
      if (!params.silent) {
        isSaving.value = false
      }
    }
  }

  return {
    isSaving,
    lastSavedContent,
    saveNote,
  }
}
