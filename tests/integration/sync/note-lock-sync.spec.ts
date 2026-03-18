import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

function createIonicStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default ? slots.default() : [])
    },
  })
}

async function mountAppForNoteLockSync(options: {
  isAuthenticated?: boolean
}) {
  vi.resetModules()

  const currentRoute = ref({
    fullPath: '/home',
    name: 'Home',
  })
  const currentUser = ref(options.isAuthenticated === false ? null : { id: 'user-a' })
  let authChangeCallback: ((token: string, user: { id: string } | null) => void | Promise<void>) | null = null

  const initializeDatabaseMock = vi.fn(async () => undefined)
  const initializeNotesMock = vi.fn(async () => undefined)
  const syncMock = vi.fn(async () => null)
  const syncSecuritySettingsFromCloudMock = vi.fn(async () => ({
    scope_key: 'note:user-a',
    pin_secret_salt: 'cloud-salt',
    pin_secret_hash: 'cloud-hash',
    pin_version: 1,
    updated: '2026-03-10 10:00:00',
  }))
  const routerReplaceMock = vi.fn(async () => undefined)

  vi.doMock('vue-router', () => ({
    useRouter: () => ({
      currentRoute,
      replace: routerReplaceMock,
      afterEach: vi.fn(() => vi.fn()),
    }),
  }))

  vi.doMock('@/processes/navigation', () => ({
    useLastVisitedRoute: () => ({
      getLastVisitedRoute: vi.fn(() => null),
      getRouteRestoreMode: vi.fn(() => 'immediate'),
      isDeferredPrivateRoute: vi.fn(() => false),
      restoreDeferredLastVisitedRoute: vi.fn(async () => undefined),
      restoreImmediateLastVisitedRoute: vi.fn(async () => undefined),
      setupAutoSave: vi.fn(),
    }),
  }))

  vi.doMock('@/processes/sync-notes', () => ({
    useSync: () => ({
      sync: syncMock,
    }),
  }))

  vi.doMock('@/features/note-lock', () => ({
    useNoteLock: () => ({
      syncSecuritySettingsFromCloud: syncSecuritySettingsFromCloudMock,
    }),
  }))

  vi.doMock('@/shared/lib/storage/guest-data', () => ({
    hasGuestData: vi.fn(async () => false),
    mergeGuestDataIntoCurrent: vi.fn(async () => undefined),
  }))

  vi.doMock('@/processes/session/model/prepare-session-context', () => ({
    prepareSessionContext: vi.fn(async (userId?: string | null) => {
      await initializeDatabaseMock(userId)
      await initializeNotesMock()
    }),
  }))

  vi.doMock('@/shared/api/pocketbase', () => ({
    pocketbaseAuthService: {
      isAuthenticated: () => options.isAuthenticated !== false,
      getCurrentAuthUser: () => currentUser.value,
      onAuthChange: (callback: typeof authChangeCallback) => {
        authChangeCallback = callback
        return vi.fn()
      },
    },
    PocketBaseRealtimeService: class {},
  }))

  vi.doMock('@/processes/session/model/auth-manager', () => ({
    authManager: {
      setAuthService: vi.fn(),
      initialize: vi.fn(async () => undefined),
      isAuthenticated: () => !!currentUser.value,
      userInfo: currentUser,
    },
  }))

  vi.doMock('@/processes/session/model/realtime-manager', () => ({
    realtimeManager: {
      setRealtimeService: vi.fn(),
      checkIsConnected: vi.fn(() => false),
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
    },
  }))

  vi.doMock('@/features/theme-switch', () => ({
    useTheme: () => ({
      initTheme: vi.fn(),
    }),
  }))

  vi.doMock('@/shared/lib/viewport', () => ({
    useVisualViewport: vi.fn(),
  }))

  vi.doMock('@/utils/logger', () => ({
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  }))

  vi.doMock('@ionic/vue', () => ({
    IonApp: createIonicStub('IonApp'),
    IonRouterOutlet: createIonicStub('IonRouterOutlet'),
    useIonRouter: () => ({
      navigate: vi.fn(),
    }),
    alertController: {
      create: vi.fn(async () => ({
        present: vi.fn(async () => undefined),
      })),
    },
  }))

  const App = (await import('@/App.vue')).default
  const wrapper = mount(App)
  await flushPromises()
  await nextTick()

  return {
    wrapper,
    currentUser,
    triggerAuthChange: async (token: string, user: { id: string } | null) => {
      currentUser.value = user
      await authChangeCallback?.(token, user)
      await flushPromises()
      await nextTick()
    },
    mocks: {
      initializeDatabaseMock,
      initializeNotesMock,
      routerReplaceMock,
      syncMock,
      syncSecuritySettingsFromCloudMock,
    },
  }
}

describe('note lock cloud sync integration (t-fn-040 / tc-fn-034, tc-fn-036)', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pulls cloud pin settings during authenticated session bootstrap', async () => {
    const { mocks } = await mountAppForNoteLockSync({
      isAuthenticated: true,
    })

    expect(mocks.initializeDatabaseMock).toHaveBeenCalledWith('user-a')
    expect(mocks.initializeNotesMock).toHaveBeenCalled()
    expect(mocks.syncMock).toHaveBeenCalledWith(true)
    expect(mocks.syncSecuritySettingsFromCloudMock).toHaveBeenCalledWith(true)
  })

  it('re-syncs cloud pin settings after guest user logs in', async () => {
    const { triggerAuthChange, mocks } = await mountAppForNoteLockSync({
      isAuthenticated: false,
    })

    expect(mocks.syncSecuritySettingsFromCloudMock).not.toHaveBeenCalled()

    await triggerAuthChange('token-1', { id: 'user-a' })

    expect(mocks.initializeDatabaseMock).toHaveBeenLastCalledWith('user-a')
    expect(mocks.syncMock).toHaveBeenCalledWith(true)
    expect(mocks.syncSecuritySettingsFromCloudMock).toHaveBeenCalledWith(true)
  })
})
