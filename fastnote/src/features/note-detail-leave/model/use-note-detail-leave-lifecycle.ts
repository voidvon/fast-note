import type { LeaveFlushReason } from '@/features/note-save'
import { onBeforeUnmount, onMounted } from 'vue'
import { onF7ViewDidLeave, onF7ViewWillLeave } from '@/shared/ui/f7'

export interface UseNoteDetailLeaveLifecycleOptions {
  clearPendingSaveTimer: () => void
  closeToolbarPanels?: () => void
  onDetailDidLeave?: () => void
  triggerLeavePageLocalFlush: (reason: LeaveFlushReason) => void
}

export function useNoteDetailLeaveLifecycle(options: UseNoteDetailLeaveLifecycleOptions) {
  function handlePageHide() {
    options.triggerLeavePageLocalFlush('pagehide')
  }

  function handleBeforeUnload() {
    options.triggerLeavePageLocalFlush('beforeunload')
  }

  onMounted(() => {
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  onBeforeUnmount(() => {
    options.clearPendingSaveTimer()
    window.removeEventListener('pagehide', handlePageHide)
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })

  onF7ViewWillLeave(() => {
    options.triggerLeavePageLocalFlush('view-leave')
    setTimeout(() => {
      options.closeToolbarPanels?.()
    }, 300)
  })

  onF7ViewDidLeave(() => {
    options.onDetailDidLeave?.()
  })

  return {
    handleBeforeUnload,
    handlePageHide,
  }
}
