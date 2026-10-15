import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('guest data decision prompt', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('prompts with verticalButtons and resolves coexist on cancel', async () => {
    const mergeGuestDataMock = vi.fn()
    let alertParams: any = null
    const presentMock = vi.fn()
    const onDismissMock = vi.fn()

    vi.doMock('@/shared/lib/storage/guest-data', () => ({
      hasGuestData: vi.fn(async () => true),
      mergeGuestDataIntoCurrent: mergeGuestDataMock,
    }))

    vi.doMock('@/shared/ui/f7', () => ({
      alertController: {
        create: vi.fn(async (params: any) => {
          alertParams = params
          return {
            present: presentMock,
            onDismiss: onDismissMock,
          }
        }),
      },
      useAppRouter: () => ({
        currentRoute: { value: { fullPath: '/home' } },
      }),
    }))

    let authCallback: any = null
    const authServiceMock = {
      isAuthenticated: vi.fn(() => false),
      getCurrentAuthUser: vi.fn(() => null),
      onAuthChange: vi.fn((cb: any) => {
        authCallback = cb
        return vi.fn()
      }),
    }

    vi.doMock('@/entities/auth', () => ({
      authService: authServiceMock,
    }))

    vi.doMock('@/processes/session/model/prepare-session-context', () => ({
      prepareSessionContext: vi.fn(),
    }))

    vi.doMock('@/processes/session/model/realtime-manager', () => ({
      realtimeManager: {
        disconnect: vi.fn(),
        setRealtimeService: vi.fn(),
        checkIsConnected: vi.fn(() => true),
        connect: vi.fn(),
      },
    }))

    vi.doMock('@/processes/sync-notes', () => ({
      useSync: () => ({
        beginSyncBootstrap: vi.fn(),
        completeSyncBootstrap: vi.fn(),
        sync: vi.fn(),
      }),
    }))

    vi.doMock('@/features/note-lock', () => ({
      useNoteLock: () => ({
        syncSecuritySettingsFromCloud: vi.fn(),
      }),
    }))

    vi.doMock('@/processes/navigation', () => ({
      useLastVisitedRoute: () => ({
        isDeferredPrivateRoute: vi.fn(() => false),
        restoreDeferredLastVisitedRoute: vi.fn(),
        restoreImmediateLastVisitedRoute: vi.fn(),
        shouldRestoreLastVisitedRouteForCurrentPath: vi.fn(() => false),
        setupAutoSave: vi.fn(),
      }),
    }))

    const { useSessionBootstrap } = await import('@/processes/session/model/use-session-bootstrap')
    const session = useSessionBootstrap()
    await session.initializeSession()

    // Simulate login transition: guest -> logged in user
    authServiceMock.getCurrentAuthUser.mockReturnValue({ id: 'user-1' } as any)
    const loginPromise = authCallback('token-123', { id: 'user-1', email: 'test@example.com' })
    await flushPromises()

    // Verify alert was created with verticalButtons: true
    expect(alertParams).not.toBeNull()
    expect(alertParams.verticalButtons).toBe(true)
    expect(alertParams.buttons).toHaveLength(2)
    expect(alertParams.buttons[0].text).toBe('上传到云端')
    expect(alertParams.buttons[1].text).toBe('仅在未登录时显示')
    expect(alertParams.buttons[1].role).toBe('cancel')

    // Click '仅在未登录时显示'
    alertParams.buttons[1].handler()

    await loginPromise

    // Should not have merged guest data
    expect(mergeGuestDataMock).not.toHaveBeenCalled()
  })

  it('merges guest data when "上传到云端" is clicked', async () => {
    const mergeGuestDataMock = vi.fn()
    let alertParams: any = null

    vi.doMock('@/shared/lib/storage/guest-data', () => ({
      hasGuestData: vi.fn(async () => true),
      mergeGuestDataIntoCurrent: mergeGuestDataMock,
    }))

    vi.doMock('@/shared/ui/f7', () => ({
      alertController: {
        create: vi.fn(async (params: any) => {
          alertParams = params
          return {
            present: vi.fn(),
            onDismiss: vi.fn(),
          }
        }),
      },
      useAppRouter: () => ({
        currentRoute: { value: { fullPath: '/home' } },
      }),
    }))

    let authCallback: any = null
    const authServiceMock = {
      isAuthenticated: vi.fn(() => false),
      getCurrentAuthUser: vi.fn(() => null),
      onAuthChange: vi.fn((cb: any) => {
        authCallback = cb
        return vi.fn()
      }),
    }

    vi.doMock('@/entities/auth', () => ({
      authService: authServiceMock,
    }))

    vi.doMock('@/processes/session/model/prepare-session-context', () => ({
      prepareSessionContext: vi.fn(),
    }))

    vi.doMock('@/processes/session/model/realtime-manager', () => ({
      realtimeManager: {
        disconnect: vi.fn(),
        setRealtimeService: vi.fn(),
        checkIsConnected: vi.fn(() => true),
        connect: vi.fn(),
      },
    }))

    vi.doMock('@/processes/sync-notes', () => ({
      useSync: () => ({
        beginSyncBootstrap: vi.fn(),
        completeSyncBootstrap: vi.fn(),
        sync: vi.fn(),
      }),
    }))

    vi.doMock('@/features/note-lock', () => ({
      useNoteLock: () => ({
        syncSecuritySettingsFromCloud: vi.fn(),
      }),
    }))

    vi.doMock('@/processes/navigation', () => ({
      useLastVisitedRoute: () => ({
        isDeferredPrivateRoute: vi.fn(() => false),
        restoreDeferredLastVisitedRoute: vi.fn(),
        restoreImmediateLastVisitedRoute: vi.fn(),
        shouldRestoreLastVisitedRouteForCurrentPath: vi.fn(() => false),
        setupAutoSave: vi.fn(),
      }),
    }))

    const { useSessionBootstrap } = await import('@/processes/session/model/use-session-bootstrap')
    const session = useSessionBootstrap()
    await session.initializeSession()

    authServiceMock.getCurrentAuthUser.mockReturnValue({ id: 'user-2' } as any)
    const loginPromise = authCallback('token-456', { id: 'user-2', email: 'user2@example.com' })
    await flushPromises()

    expect(alertParams).not.toBeNull()
    // Click '上传到云端'
    alertParams.buttons[0].handler()

    await loginPromise

    expect(mergeGuestDataMock).toHaveBeenCalledTimes(1)
  })
})
