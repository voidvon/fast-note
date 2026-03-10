import { describe, expect, it, vi } from 'vitest'
import {
  createNoteUnlockSession,
  DEFAULT_NOTE_UNLOCK_SESSION_TTL,
  isNoteUnlockSessionValid,
} from '@/hooks/useNoteLock'

describe('useNoteLock session helpers (t-fn-036 / tc-fn-032 foundation)', () => {
  it('creates a valid session using the default ttl', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'))

      const session = createNoteUnlockSession('note-1')

      expect(session.note_id).toBe('note-1')
      expect(session.verified_at).toBe(Date.parse('2026-03-10T10:00:00.000Z'))
      expect(session.expires_at).toBe(session.verified_at! + DEFAULT_NOTE_UNLOCK_SESSION_TTL)
      expect(session.failed_attempts).toBe(0)
      expect(isNoteUnlockSessionValid(session, session.verified_at! + 1000)).toBe(true)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('marks expired or cooling-down sessions as invalid', () => {
    const session = createNoteUnlockSession('note-2', {
      now: 1000,
      sessionTtl: 5000,
    })

    expect(isNoteUnlockSessionValid(session, 6001)).toBe(false)
    expect(isNoteUnlockSessionValid({
      ...session,
      cooldown_until: 4000,
    }, 3000)).toBe(false)
  })
})
