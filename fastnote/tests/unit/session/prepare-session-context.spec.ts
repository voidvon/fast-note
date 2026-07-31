import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('prepare session context', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('serializes overlapping database scope changes', async () => {
    let currentDatabaseName = ''
    let activeInitializations = 0
    let maxActiveInitializations = 0
    let releaseGuestInitialization!: () => void
    const guestInitializationPending = new Promise<void>((resolve) => {
      releaseGuestInitialization = resolve
    })
    const events: string[] = []

    vi.doMock('@/shared/lib/user-scope', () => ({
      getScopedDatabaseName: (userId?: string | null) => `note:${userId || 'guest'}`,
    }))
    vi.doMock('@/shared/lib/storage', () => ({
      getCurrentDatabaseName: () => currentDatabaseName,
      initializeDatabase: vi.fn(async (userId?: string | null) => {
        const name = `note:${userId || 'guest'}`
        activeInitializations++
        maxActiveInitializations = Math.max(maxActiveInitializations, activeInitializations)
        events.push(`open:${name}`)
        if (!userId)
          await guestInitializationPending
        currentDatabaseName = name
        activeInitializations--
      }),
    }))
    vi.doMock('@/entities/note', () => ({
      disposeNotesContext: vi.fn(async () => {
        events.push(`dispose:${currentDatabaseName || 'none'}`)
      }),
      initializeNotes: vi.fn(async () => {
        events.push(`notes:${currentDatabaseName}`)
      }),
    }))

    const { prepareSessionContext } = await import('@/processes/session/model/prepare-session-context')
    const guestPreparation = prepareSessionContext()
    await Promise.resolve()
    const userPreparation = prepareSessionContext('user-a')
    await Promise.resolve()

    expect(maxActiveInitializations).toBe(1)
    releaseGuestInitialization()
    await Promise.all([guestPreparation, userPreparation])

    expect(maxActiveInitializations).toBe(1)
    expect(events).toEqual([
      'dispose:none',
      'open:note:guest',
      'notes:note:guest',
      'dispose:note:guest',
      'open:note:user-a',
      'notes:note:user-a',
    ])
  })
})
