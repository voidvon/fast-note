import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
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

async function mountAppForImmediateRestore(options: {
  initialUserId?: string | null
  savedRoutes: Record<string, string>
}) {
  vi.resetModules()
  localStorage.clear()

  const currentRoute = ref({
    fullPath: '/login',
    name: 'Login',
  })

  const sessionUser = ref(options.initialUserId ? { id: options.initialUserId } : null)
  let authChangeHandler: ((token: string | null, user: { id: string } | null) => void | Promise<void>) | null = null

  const routerReplaceMock = vi.fn(async (target: string | { path: string }) => {
    const fullPath = typeof target === 'string' ? target : target.path
    currentRoute.value = {
      fullPath,
      name: fullPath === '/home' ? 'Home' : 'UserHome',
    }
  })

  Object.entries(options.savedRoutes).forEach(([userId, route]) => {
    localStorage.setItem(getLastVisitedRouteStorageKey(userId === 'guest' ? null : userId), route)
  })

  const syncDeferred = deferred<null>()
  const syncMock = vi.fn(async () => syncDeferred.promise)
  const ionNavigateMock = vi.fn(async (target: string) => {
    currentRoute.value = {
      fullPath: target,
      name: target === '/home' ? 'Home' : 'UserHome',
    }
  })

  vi.doMock('vue-router', () => ({
    useRouter: () => ({
      currentRoute,
      replace: routerReplaceMock,
      afterEach: vi.fn(() => vi.fn()),
    }),
  }))

  vi.doMock('@/shared/api/pocketbase', () => ({
    pocketbaseAuthService: {
      isAuthenticated: () => !!sessionUser.value,
      getCurrentAuthUser: () => sessionUser.value,
      onAuthChange: vi.fn((callback: typeof authChangeHandler) => {
        authChangeHandler = callback
        return vi.fn()
      }),
    },
    PocketBaseRealtimeService: class {},
  }))

  vi.doMock('@/core/auth-manager', async () => ({
    authManager: {
      setAuthService: vi.fn(),
      initialize: vi.fn(async () => undefined),
      isAuthenticated: () => !!sessionUser.value,
      userInfo: computed(() => sessionUser.value),
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
    prepareSessionContext: vi.fn(async () => undefined),
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
      navigate: ionNavigateMock,
    }),
    alertController: {
      create: vi.fn(async () => ({
        present: vi.fn(async () => undefined),
      })),
    },
  }))

  const App = (await import('@/App.vue')).default
  mount(App)
  await flushPromises()
  await nextTick()

  async function triggerAuthChange(token: string | null, user: { id: string } | null) {
    sessionUser.value = user
    void authChangeHandler?.(token, user)
    await flushPromises()
    await nextTick()
  }

  return {
    currentRoute,
    mocks: {
      routerReplaceMock,
      syncDeferred,
      triggerAuthChange,
    },
  }
}

describe('public and home restore timing (t-fn-031 / tc-fn-027)', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('restores /home immediately without waiting for sync', async () => {
    const { mocks } = await mountAppForImmediateRestore({
      initialUserId: 'user-a',
      savedRoutes: { 'user-a': '/home' },
    })

    expect(mocks.routerReplaceMock).toHaveBeenCalledWith('/home')
  })

  it('restores public route immediately without waiting for sync', async () => {
    const { mocks } = await mountAppForImmediateRestore({
      initialUserId: 'user-a',
      savedRoutes: { 'user-a': '/alice' },
    })

    expect(mocks.routerReplaceMock).toHaveBeenCalledWith('/alice')
  })

  it('restores the switched user immediate route from that user scope', async () => {
    const { mocks } = await mountAppForImmediateRestore({
      initialUserId: 'user-a',
      savedRoutes: {
        'user-a': '/home',
        'user-b': '/bob',
      },
    })

    mocks.routerReplaceMock.mockClear()
    await mocks.triggerAuthChange('token-b', { id: 'user-b' })

    expect(mocks.routerReplaceMock).toHaveBeenCalledWith('/bob')
  })
})
