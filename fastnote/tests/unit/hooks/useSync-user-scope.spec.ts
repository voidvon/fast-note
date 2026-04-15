import { describe, expect, it, vi } from 'vitest'
import { getDesktopActiveNoteStorageKey, useDesktopActiveNote } from '@/processes/navigation'
import { getLastVisitedRouteStorageKey, useLastVisitedRoute } from '@/processes/navigation'
import { getSyncCursorStorageKey, readSyncCursor, writeSyncCursor } from '@/processes/sync-notes'
import { authService } from '@/shared/api/pocketbase'
import { getScopedDatabaseName } from '@/shared/lib/user-scope'

describe('t-fn-029 / tc-fn-022 user scoped sync context', () => {
  it('isolates sync cursor by user id', () => {
    writeSyncCursor('2026-03-09 10:00:00', 'user-a')
    writeSyncCursor('2026-03-09 11:00:00', 'user-b')

    expect(getSyncCursorStorageKey('user-a')).toBe('pocketbaseUpdated:user-a')
    expect(getSyncCursorStorageKey('user-b')).toBe('pocketbaseUpdated:user-b')
    expect(readSyncCursor('user-a')).toBe('2026-03-09 10:00:00')
    expect(readSyncCursor('user-b')).toBe('2026-03-09 11:00:00')
  })

  it('isolates last visited route by user id', () => {
    const { saveCurrentRoute, getLastVisitedRoute } = useLastVisitedRoute()
    const router = {
      currentRoute: {
        value: {
          name: 'NoteDetail',
          fullPath: '/n/user-a-note',
        },
      },
      afterEach: vi.fn(() => vi.fn()),
      replace: vi.fn(),
    } as any

    saveCurrentRoute(router, 'user-a')
    router.currentRoute.value.fullPath = '/n/user-b-note'
    saveCurrentRoute(router, 'user-b')

    expect(getLastVisitedRouteStorageKey('user-a')).toBe('flashnote_last_visited_route:user-a')
    expect(getLastVisitedRouteStorageKey('user-b')).toBe('flashnote_last_visited_route:user-b')
    expect(getLastVisitedRoute('user-a')).toBe('/n/user-a-note')
    expect(getLastVisitedRoute('user-b')).toBe('/n/user-b-note')
  })

  it('builds dexie database name from current user scope', () => {
    const authSpy = vi.spyOn(authService, 'getCurrentAuthUser')

    authSpy.mockReturnValue({ id: 'user-a' } as any)
    expect(getScopedDatabaseName()).toBe('note:user-a')

    authSpy.mockReturnValue({ id: 'user-b' } as any)
    expect(getScopedDatabaseName()).toBe('note:user-b')

    authSpy.mockReturnValue(null)
    expect(getScopedDatabaseName()).toBe('note:guest')
  })

  it('isolates desktop home snapshot by user id', () => {
    const { saveSnapshot, getSnapshot } = useDesktopActiveNote(localStorage)

    saveSnapshot({ folderId: 'allnotes', noteId: 'note-a', parentId: '' }, 'user-a')
    saveSnapshot({ folderId: 'allnotes', noteId: 'note-b', parentId: '' }, 'user-b')

    expect(getDesktopActiveNoteStorageKey('user-a')).toBe('flashnote_desktop_active_note_v1:user-a')
    expect(getDesktopActiveNoteStorageKey('user-b')).toBe('flashnote_desktop_active_note_v1:user-b')
    expect(getSnapshot('user-a')).toMatchObject({ noteId: 'note-a' })
    expect(getSnapshot('user-b')).toMatchObject({ noteId: 'note-b' })
  })
})
