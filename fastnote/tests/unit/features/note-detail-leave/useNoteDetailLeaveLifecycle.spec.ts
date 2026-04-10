import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useNoteDetailLeaveLifecycle } from '@/features/note-detail-leave'

let ionViewDidLeaveCallback: (() => void | Promise<void>) | null = null
let ionViewWillLeaveCallback: (() => void | Promise<void>) | null = null

vi.mock('@ionic/vue', () => ({
  onIonViewDidLeave: (callback: () => void | Promise<void>) => {
    ionViewDidLeaveCallback = callback
  },
  onIonViewWillLeave: (callback: () => void | Promise<void>) => {
    ionViewWillLeaveCallback = callback
  },
}))

describe('useNoteDetailLeaveLifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ionViewDidLeaveCallback = null
    ionViewWillLeaveCallback = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('binds window and ion leave lifecycle to local flush callbacks', async () => {
    const clearPendingSaveTimer = vi.fn()
    const closeToolbarPanels = vi.fn()
    const onDetailDidLeave = vi.fn()
    const triggerLeavePageLocalFlush = vi.fn()
    const Harness = defineComponent({
      setup() {
        useNoteDetailLeaveLifecycle({
          clearPendingSaveTimer,
          closeToolbarPanels,
          onDetailDidLeave,
          triggerLeavePageLocalFlush,
        })

        return () => null
      },
    })

    const wrapper = mount(Harness)

    window.dispatchEvent(new Event('pagehide'))
    window.dispatchEvent(new Event('beforeunload'))

    expect(triggerLeavePageLocalFlush).toHaveBeenNthCalledWith(1, 'pagehide')
    expect(triggerLeavePageLocalFlush).toHaveBeenNthCalledWith(2, 'beforeunload')

    await ionViewWillLeaveCallback?.()
    expect(triggerLeavePageLocalFlush).toHaveBeenNthCalledWith(3, 'view-leave')
    expect(closeToolbarPanels).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    expect(closeToolbarPanels).toHaveBeenCalledTimes(1)

    await ionViewDidLeaveCallback?.()
    expect(onDetailDidLeave).toHaveBeenCalledTimes(1)

    wrapper.unmount()

    expect(clearPendingSaveTimer).toHaveBeenCalledTimes(1)

    triggerLeavePageLocalFlush.mockClear()
    window.dispatchEvent(new Event('pagehide'))
    window.dispatchEvent(new Event('beforeunload'))
    expect(triggerLeavePageLocalFlush).not.toHaveBeenCalled()
  })
})
