import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { getLastVisitedRouteStorageKey } from '@/processes/navigation'

function createIonicStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default ? slots.default() : [])
    },
  })
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

async function mountAppForRouteRestore(options: {
  currentPath: string
  currentName?: string
  savedLastRoute?: string
  isAuthenticated?: boolean
}) {
  vi.resetModules()
  localStorage.clear()

  const currentRoute = ref({
    fullPath: options.currentPath,
    name: options.currentName ?? 'Home',
  })

  const routerReplaceMock = vi.fn(async (target: string | { path: string }) => {
    const fullPath = typeof target === 'string' ? target : target.path
    currentRoute.value = {
      fullPath,
      name: fullPath === '/home' ? 'Home' : 'NoteDetail',
    }
  })

  if (options.savedLastRoute) {
    localStorage.setItem(getLastVisitedRouteStorageKey('user-a'), options.savedLastRoute)
  }

  const syncDeferred = deferred<null>()
  const syncMock = vi.fn(async () => syncDeferred.promise)
  const initializeDatabaseMock = vi.fn(async () => undefined)
  const initializeNotesMock = vi.fn(async () => undefined)
  const authChangeMock = vi.fn(() => vi.fn())

  vi.doMock('vue-router', () => ({
    useRouter: () => ({
      currentRoute,
      replace: routerReplaceMock,
      afterEach: vi.fn(() => vi.fn()),
    }),
  }))

  vi.doMock('@/shared/api/pocketbase', () => ({
    pocketbaseAuthService: {
      isAuthenticated: () => options.isAuthenticated ?? true,
      getCurrentAuthUser: () => ((options.isAuthenticated ?? true) ? { id: 'user-a' } : null),
      onAuthChange: authChangeMock,
    },
    PocketBaseRealtimeService: class {},
  }))

  vi.doMock('@/core/auth-manager', async () => ({
    authManager: {
      setAuthService: vi.fn(),
      initialize: vi.fn(async () => undefined),
      isAuthenticated: () => options.isAuthenticated ?? true,
      userInfo: ref((options.isAuthenticated ?? true) ? { id: 'user-a' } : null),
    },
  }))

  vi.doMock('@/core/realtime-manager', () => ({
    realtimeManager: {
      setRealtimeService: vi.fn(),
      checkIsConnected: vi.fn(() => false),
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
    },
  }))

  vi.doMock('@/processes/sync-notes', () => ({
    useSync: () => ({
      sync: syncMock,
    }),
  }))

  vi.doMock('@/features/note-lock', () => ({
    useNoteLock: () => ({
      syncSecuritySettingsFromCloud: vi.fn(async () => undefined),
    }),
  }))

  vi.doMock('@/shared/lib/storage/guest-data', () => ({
    hasGuestData: vi.fn(async () => false),
    mergeGuestDataIntoCurrent: vi.fn(async () => undefined),
  }))

  vi.doMock('@/processes/session/model/prepare-session-context', () => ({
    prepareSessionContext: vi.fn(async () => {
      await initializeDatabaseMock()
      await initializeNotesMock()
    }),
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
    currentRoute,
    mocks: {
      authChangeMock,
      initializeDatabaseMock,
      initializeNotesMock,
      routerReplaceMock,
      syncDeferred,
      syncMock,
    },
  }
}

describe('private route restore timing (t-fn-031 / tc-fn-023)', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not block when opening an already-restored private detail route', async () => {
    const { wrapper, mocks } = await mountAppForRouteRestore({
      currentPath: '/n/private-note',
      currentName: 'NoteDetail',
      savedLastRoute: '/n/private-note',
    })

    expect(wrapper.find('[data-testid="app-private-route-pending"]').exists()).toBe(false)
    expect(mocks.routerReplaceMock).not.toHaveBeenCalledWith('/n/private-note')
  })

  it('restores saved private detail immediately during app startup', async () => {
    const { mocks } = await mountAppForRouteRestore({
      currentPath: '/home',
      currentName: 'Home',
      savedLastRoute: '/n/private-note',
    })

    expect(mocks.routerReplaceMock).toHaveBeenCalledWith('/n/private-note')
  })
})
