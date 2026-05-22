import type { Note } from '@/shared/types'
import { ref } from 'vue'
import { useNoteWrite } from '@/features/note-write'
import { NOTE_TYPE } from '@/shared/types'
import { saveExistingNote } from './save-existing-note'

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
  getCurrentEffectiveUuid?: () => string | null
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

interface PreparedSaveRequest {
  baselineContent: string
  content: string
  hasMeaningfulContent: boolean
  isDesktop: boolean
  isMissingPrivateNote: boolean
  leaveFlushReason: LeaveFlushReason | null
  noteId: string
  parentId?: string
  routeParentId?: unknown
  silent: boolean
  summary: string
  title: string
  wasNewNote: boolean
}

export function useNoteSave(options: UseNoteSaveOptions) {
  const isSaving = ref(false)
  const lastSavedContent = ref('')
  const savedContentByNoteId = new Map<string, string>()
  let saveQueue = Promise.resolve()
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

  function isSaveForced(params: SaveNoteParams) {
    return !!params.leaveFlushReason || !!params.saveTargetContext?.noteId
  }

  function isActiveTarget(noteId: string) {
    const currentEffectiveUuid = options.getCurrentEffectiveUuid?.()
    if (currentEffectiveUuid) {
      return currentEffectiveUuid === noteId
    }

    const currentNoteId = options.getCurrentNote?.()?.id
    if (currentNoteId) {
      return currentNoteId === noteId
    }

    return true
  }

  function prepareSaveRequest(params: SaveNoteParams): PreparedSaveRequest | null {
    if (!params.editor) {
      return null
    }

    if (params.isFormatModalOpen && !isSaveForced(params)) {
      return null
    }

    const content = params.editor.getContent() || ''
    const hasMeaningfulContent = params.editor.isMeaningfulContent?.() ?? !!content
    let { title, summary } = params.editor.getTitle()
    const noteId = params.saveTargetContext?.noteId ?? params.effectiveUuid
    const wasNewNote = params.saveTargetContext?.wasNewNote ?? params.isNewNote

    if (!noteId) {
      return null
    }

    if (!title || title.trim() === '') {
      title = '新建备忘录'
    }

    return {
      baselineContent: savedContentByNoteId.get(noteId) ?? lastSavedContent.value,
      content,
      hasMeaningfulContent,
      isDesktop: params.isDesktop,
      isMissingPrivateNote: !!params.isMissingPrivateNote,
      leaveFlushReason: params.leaveFlushReason ?? null,
      noteId,
      parentId: params.parentId,
      routeParentId: params.routeParentId,
      silent: !!params.silent,
      summary,
      title,
      wasNewNote,
    }
  }

  async function performSave(request: PreparedSaveRequest) {
    const {
      baselineContent,
      content,
      hasMeaningfulContent,
      isDesktop,
      isMissingPrivateNote,
      leaveFlushReason,
      noteId,
      parentId,
      routeParentId,
      silent,
      summary,
      title,
      wasNewNote,
    } = request

    const noteExists = await options.getNote(noteId)

    if (wasNewNote && !noteExists && !hasMeaningfulContent) {
      await flushNotesToLocalIfNeeded(leaveFlushReason)
      return
    }

    const savedBaseline = savedContentByNoteId.get(noteId) ?? baselineContent
    if (content === savedBaseline) {
      if (isActiveTarget(noteId)) {
        lastSavedContent.value = content
      }

      await flushNotesToLocalIfNeeded(leaveFlushReason)
      return
    }

    if (isMissingPrivateNote) {
      await flushNotesToLocalIfNeeded(leaveFlushReason)
      if (!silent) {
        await options.presentTopError('当前备忘录不存在或尚未同步完成')
      }
      return
    }

    if (!silent) {
      isSaving.value = true
    }

    options.restoreHeight()

    const fileHashes: string[] = []

    try {
      if (noteExists) {
        const updateResult = await saveExistingNote({
          sync: silent ? undefined : options.sync,
          writeNote: noteWrite.updateNote,
        }, {
          noteId,
          title,
          summary,
          content,
          files: fileHashes,
        })
        if (!updateResult.ok || !updateResult.note) {
          throw new Error(updateResult.message || '更新备忘录失败')
        }

        if (isActiveTarget(noteId)) {
          options.setCurrentNote?.(updateResult.note)
        }

        if (!silent && isActiveTarget(noteId)) {
          options.emitNoteSaved?.({
            noteId,
            isNew: false,
          })
        }

        if (!silent && !updateResult.syncQueued) {
          await options.presentTopError('同步失败，请检查网络连接')
        }
      }
      else {
        if (!wasNewNote) {
          if (isActiveTarget(noteId)) {
            options.setMissingPrivateNote?.(true)
            options.setCurrentNote?.(null)
            options.onMissingPrivateNote?.()
          }

          if (!silent) {
            await options.presentTopError('当前备忘录不存在或尚未同步完成')
          }
          return
        }

        const createResult = await noteWrite.createNote({
          noteId,
          title,
          summary,
          content,
          parentId: resolveParentId(isDesktop, parentId, routeParentId),
          itemType: NOTE_TYPE.NOTE,
          files: fileHashes,
        })
        if (!createResult.ok || !createResult.note) {
          throw new Error(createResult.message || '创建备忘录失败')
        }

        if (isActiveTarget(noteId)) {
          options.setCurrentNote?.(createResult.note)
          options.onRouteDraftCreated?.(noteId)
        }

        if (!silent && isActiveTarget(noteId)) {
          options.emitNoteSaved?.({
            noteId,
            isNew: true,
          })
        }
      }

      savedContentByNoteId.set(noteId, content)
      if (isActiveTarget(noteId)) {
        lastSavedContent.value = content
      }

      await flushNotesToLocalIfNeeded(leaveFlushReason)

      if (!silent && !noteExists) {
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
      if (!silent) {
        isSaving.value = false
      }
    }
  }

  function saveNote(params: SaveNoteParams) {
    const request = prepareSaveRequest(params)
    if (!request) {
      return Promise.resolve()
    }

    const run = saveQueue.then(() => performSave(request))
    saveQueue = run.catch(() => {})
    return run
  }

  return {
    isSaving,
    lastSavedContent,
    saveNote,
  }
}
