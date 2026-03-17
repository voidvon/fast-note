import type { LeaveFlushReason } from '@/features/note-save'
import { onIonViewDidLeave, onIonViewWillLeave } from '@ionic/vue'
import { onBeforeUnmount, onMounted } from 'vue'

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

  onIonViewWillLeave(() => {
    options.triggerLeavePageLocalFlush('view-leave')
    setTimeout(() => {
      options.closeToolbarPanels?.()
    }, 300)
  })

  onIonViewDidLeave(() => {
    options.onDetailDidLeave?.()
  })

  return {
    handleBeforeUnload,
    handlePageHide,
  }
}
