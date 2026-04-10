import type { LeaveFlushReason, SaveTargetContext } from '@/features/note-save'
import { ref } from 'vue'

type MaybePromise<T> = T | Promise<T>

export interface NoteDetailRouteTransition {
  isMobileLeavingDetailPage: boolean
  previousEffectiveId: string | null
  previousWasNewNote: boolean
  shouldSavePreviousDesktopSelection: boolean
}

export interface UseNoteDetailLeaveOptions {
  getDraftId: () => string | null
  getEffectiveUuid: () => string | null
  getNotesSync: () => { manualSync: () => MaybePromise<void> } | null | undefined
  isDesktop: () => boolean
  isRouteDraftCreated: () => boolean
  onSave: (silent?: boolean, leaveFlushReason?: LeaveFlushReason | null, saveTargetContext?: SaveTargetContext) => MaybePromise<void>
}

export function useNoteDetailLeave(options: UseNoteDetailLeaveOptions) {
  const saveTimer = ref<number | null>(null)

  function clearPendingSaveTimer() {
    if (saveTimer.value) {
      clearTimeout(saveTimer.value)
      saveTimer.value = null
    }
  }

  function debouncedSave(silent = false) {
    clearPendingSaveTimer()

    saveTimer.value = window.setTimeout(() => {
      saveTimer.value = null
      void options.onSave(silent)
    }, 800)
  }

  function analyzeRouteTransition(oldId?: string | null, nextId?: string | null): NoteDetailRouteTransition {
    const previousEffectiveId = oldId === '0' ? options.getDraftId() : (oldId || null)
    const previousWasNewNote = oldId === '0' && !options.isRouteDraftCreated()

    return {
      isMobileLeavingDetailPage: !options.isDesktop() && !!oldId && !nextId,
      previousEffectiveId,
      previousWasNewNote,
      shouldSavePreviousDesktopSelection: !!oldId && oldId !== nextId && options.isDesktop(),
    }
  }

  async function handleRouteTransition(oldId?: string | null, nextId?: string | null) {
    const transition = analyzeRouteTransition(oldId, nextId)

    if (transition.shouldSavePreviousDesktopSelection && transition.previousEffectiveId) {
      await options.onSave(true, null, {
        noteId: transition.previousEffectiveId,
        wasNewNote: transition.previousWasNewNote,
      })
    }

    return transition
  }

  async function flushNotesToLocal(reason: LeaveFlushReason) {
    const notesSync = options.getNotesSync()
    if (!notesSync) {
      return
    }

    try {
      console.warn('NoteDetail 离开页触发本地落盘', {
        reason,
        noteId: options.getEffectiveUuid(),
      })
      await notesSync.manualSync()
    }
    catch (error) {
      console.error('NoteDetail 本地落盘兜底失败:', error)
    }
  }

  function triggerLeavePageLocalFlush(reason: LeaveFlushReason) {
    clearPendingSaveTimer()
    void options.onSave(true, reason)
  }

  return {
    analyzeRouteTransition,
    clearPendingSaveTimer,
    debouncedSave,
    flushNotesToLocal,
    handleRouteTransition,
    saveTimer,
    triggerLeavePageLocalFlush,
  }
}
