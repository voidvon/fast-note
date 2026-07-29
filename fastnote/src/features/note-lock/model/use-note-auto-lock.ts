import type { NoteUnlockSession } from '@/shared/types'
import { onBeforeUnmount, onMounted } from 'vue'
import { DEFAULT_NOTE_UNLOCK_SESSION_TTL } from './use-note-lock'

type MaybePromise<T> = T | Promise<T>

export type NoteAutoLockReason = 'background' | 'idle'

export interface UseNoteAutoLockOptions {
  idleMs?: number
  isMobile: () => boolean
  mobileBackgroundMs?: number
  now?: () => number
  onAutoLock: (reason: NoteAutoLockReason) => MaybePromise<void>
  renewSession: (noteId: string, ttl?: number) => MaybePromise<NoteUnlockSession | null>
  renewalThrottleMs?: number
}

export const DEFAULT_NOTE_AUTO_LOCK_IDLE_MS = DEFAULT_NOTE_UNLOCK_SESSION_TTL
export const DEFAULT_NOTE_AUTO_LOCK_MOBILE_BACKGROUND_MS = 30 * 1000
export const DEFAULT_NOTE_AUTO_LOCK_RENEWAL_THROTTLE_MS = 30 * 1000

export function useNoteAutoLock(options: UseNoteAutoLockOptions) {
  const idleMs = options.idleMs ?? DEFAULT_NOTE_AUTO_LOCK_IDLE_MS
  const mobileBackgroundMs = options.mobileBackgroundMs ?? DEFAULT_NOTE_AUTO_LOCK_MOBILE_BACKGROUND_MS
  const renewalThrottleMs = options.renewalThrottleMs ?? DEFAULT_NOTE_AUTO_LOCK_RENEWAL_THROTTLE_MS
  const now = options.now ?? (() => Date.now())
  let activeNoteId: string | null = null
  let idleDeadline = 0
  let hiddenAt: number | null = null
  let lastRenewalAt = 0
  let lockTimer: number | null = null
  let isLocking = false
  let renewalQueue = Promise.resolve()

  function clearLockTimer() {
    if (lockTimer !== null) {
      window.clearTimeout(lockTimer)
      lockTimer = null
    }
  }

  function deactivate() {
    activeNoteId = null
    idleDeadline = 0
    hiddenAt = null
    lastRenewalAt = 0
    isLocking = false
    clearLockTimer()
  }

  async function triggerAutoLock(reason: NoteAutoLockReason) {
    if (!activeNoteId || isLocking) {
      return
    }

    isLocking = true
    clearLockTimer()

    try {
      await renewalQueue
      await options.onAutoLock(reason)
    }
    finally {
      deactivate()
    }
  }

  function scheduleLock(deadline: number, reason: NoteAutoLockReason) {
    clearLockTimer()
    if (!activeNoteId || typeof window === 'undefined') {
      return
    }

    const delay = Math.max(deadline - now(), 0) + 16
    lockTimer = window.setTimeout(() => {
      void triggerAutoLock(reason)
    }, delay)
  }

  function scheduleIdleLock() {
    scheduleLock(idleDeadline, 'idle')
  }

  async function persistRenewal(noteId: string, ttl: number) {
    try {
      const session = await Promise.resolve(options.renewSession(noteId, ttl))
      if (!session && activeNoteId === noteId) {
        void triggerAutoLock('idle')
      }
    }
    catch (error) {
      console.error('续期备忘录解锁会话失败:', error)
      if (activeNoteId === noteId) {
        void triggerAutoLock('idle')
      }
    }
  }

  function renewPersistedSession(ttl: number, force = false) {
    const noteId = activeNoteId
    const currentTime = now()
    if (!noteId || (!force && currentTime - lastRenewalAt < renewalThrottleMs)) {
      return
    }

    lastRenewalAt = currentTime
    renewalQueue = renewalQueue.then(() => persistRenewal(noteId, ttl))
  }

  function recordActivity() {
    if (!activeNoteId || isLocking || document.visibilityState === 'hidden') {
      return
    }

    idleDeadline = now() + idleMs
    scheduleIdleLock()
    renewPersistedSession(idleMs)
  }

  function activate(noteId: string) {
    if (!noteId) {
      deactivate()
      return
    }

    activeNoteId = noteId
    hiddenAt = null
    lastRenewalAt = 0
    isLocking = false
    recordActivity()
  }

  function handleVisibilityChange() {
    if (!activeNoteId) {
      return
    }

    const currentTime = now()
    if (document.visibilityState === 'hidden') {
      hiddenAt = currentTime

      if (options.isMobile()) {
        const backgroundDeadline = Math.min(idleDeadline, currentTime + mobileBackgroundMs)
        scheduleLock(backgroundDeadline, backgroundDeadline < idleDeadline ? 'background' : 'idle')
        renewPersistedSession(Math.max(backgroundDeadline - currentTime, 0), true)
      }
      return
    }

    if (currentTime >= idleDeadline) {
      void triggerAutoLock('idle')
      return
    }

    if (options.isMobile() && hiddenAt !== null && currentTime - hiddenAt >= mobileBackgroundMs) {
      void triggerAutoLock('background')
      return
    }

    hiddenAt = null
    recordActivity()
    renewPersistedSession(idleMs, true)
  }

  onMounted(() => {
    document.addEventListener('input', recordActivity, true)
    document.addEventListener('keydown', recordActivity, true)
    document.addEventListener('pointerdown', recordActivity, true)
    document.addEventListener('scroll', recordActivity, true)
    document.addEventListener('touchstart', recordActivity, true)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onBeforeUnmount(() => {
    deactivate()
    document.removeEventListener('input', recordActivity, true)
    document.removeEventListener('keydown', recordActivity, true)
    document.removeEventListener('pointerdown', recordActivity, true)
    document.removeEventListener('scroll', recordActivity, true)
    document.removeEventListener('touchstart', recordActivity, true)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return {
    activate,
    deactivate,
    recordActivity,
  }
}
