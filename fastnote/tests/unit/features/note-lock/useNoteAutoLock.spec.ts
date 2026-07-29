import type { NoteUnlockSession } from '@/shared/types'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useNoteAutoLock } from '@/features/note-lock/model/use-note-auto-lock'

const mountedWrappers: Array<ReturnType<typeof mount>> = []

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

function createSession(noteId: string, expiresAt = Date.now() + 5 * 60 * 1000): NoteUnlockSession {
  return {
    note_id: noteId,
    verified_at: Date.now(),
    expires_at: expiresAt,
    failed_attempts: 0,
    cooldown_until: null,
    updated: '2026-07-29 12:00:00',
  }
}

function mountHarness(options: {
  isMobile?: boolean
  onAutoLock?: (reason: 'background' | 'idle') => void | Promise<void>
  renewSession?: (noteId: string, ttl?: number) => NoteUnlockSession | null | Promise<NoteUnlockSession | null>
} = {}) {
  const onAutoLock = vi.fn(options.onAutoLock ?? (() => undefined))
  const renewSession = vi.fn(options.renewSession ?? ((noteId: string, ttl = 0) => createSession(noteId, Date.now() + ttl)))
  let autoLock!: ReturnType<typeof useNoteAutoLock>

  const wrapper = mount(defineComponent({
    setup() {
      autoLock = useNoteAutoLock({
        isMobile: () => options.isMobile ?? false,
        onAutoLock,
        renewSession,
      })
      return () => null
    },
  }))
  mountedWrappers.push(wrapper)

  return { autoLock, onAutoLock, renewSession, wrapper }
}

describe('useNoteAutoLock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-29T04:00:00.000Z'))
    setVisibility('visible')
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
    vi.useRealTimers()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
  })

  it('locks after five minutes without activity', async () => {
    const { autoLock, onAutoLock } = mountHarness()
    autoLock.activate('note-1')

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 20)

    expect(onAutoLock).toHaveBeenCalledOnce()
    expect(onAutoLock).toHaveBeenCalledWith('idle')
  })

  it('extends the idle deadline for meaningful activity', async () => {
    const { autoLock, onAutoLock } = mountHarness()
    autoLock.activate('note-1')

    await vi.advanceTimersByTimeAsync(4 * 60 * 1000 + 30 * 1000)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    await vi.advanceTimersByTimeAsync(60 * 1000)

    expect(onAutoLock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(4 * 60 * 1000 + 20)
    expect(onAutoLock).toHaveBeenCalledWith('idle')
  })

  it('does not treat mouse movement as meaningful activity', async () => {
    const { autoLock, onAutoLock } = mountHarness()
    autoLock.activate('note-1')

    await vi.advanceTimersByTimeAsync(4 * 60 * 1000)
    document.dispatchEvent(new MouseEvent('mousemove'))
    await vi.advanceTimersByTimeAsync(60 * 1000 + 20)

    expect(onAutoLock).toHaveBeenCalledWith('idle')
  })

  it('locks a mobile note after thirty seconds in the background', async () => {
    const { autoLock, onAutoLock, renewSession } = mountHarness({ isMobile: true })
    autoLock.activate('note-1')
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(0)

    expect(renewSession).toHaveBeenLastCalledWith('note-1', 30 * 1000)

    await vi.advanceTimersByTimeAsync(30 * 1000 + 20)
    expect(onAutoLock).toHaveBeenCalledWith('background')
  })

  it('keeps the normal idle deadline when a desktop window is hidden', async () => {
    const { autoLock, onAutoLock } = mountHarness({ isMobile: false })
    autoLock.activate('note-1')
    setVisibility('hidden')

    await vi.advanceTimersByTimeAsync(30 * 1000 + 20)
    expect(onAutoLock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(4 * 60 * 1000 + 30 * 1000)
    expect(onAutoLock).toHaveBeenCalledWith('idle')
  })

  it('locks when the local unlock session cannot be renewed', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { autoLock, onAutoLock } = mountHarness({
      renewSession: async () => {
        throw new Error('storage unavailable')
      },
    })

    autoLock.activate('note-1')
    await vi.advanceTimersByTimeAsync(0)

    expect(onAutoLock).toHaveBeenCalledWith('idle')
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
