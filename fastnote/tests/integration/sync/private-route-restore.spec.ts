import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, onMounted, ref } from 'vue'
import { getLastVisitedRouteStorageKey } from '@/processes/navigation'

function createF7Stub(name: string) {
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
  window.history.replaceState({}, '', options.currentPath)

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
  const routeHandlers = new Map<string, Set<(route: { url: string }) => void>>()
  const framework7Router = {
    currentRoute: { url: options.currentPath },
    navigate: vi.fn((target: string) => {
      void routerReplaceMock(target)
      framework7Router.currentRoute = { url: target }
      routeHandlers.get('routeChange')?.forEach(handler => handler({ url: target }))
      routeHandlers.get('routeChanged')?.forEach(handler => handler({ url: target }))
    }),
    on: vi.fn((event: string, handler: (route: { url: string }) => void) => {
      const handlers = routeHandlers.get(event) || new Set()
      handlers.add(handler)
      routeHandlers.set(event, handlers)
    }),
    off: vi.fn((event: string, handler: (route: { url: string }) => void) => {
      routeHandlers.get(event)?.delete(handler)
    }),
  }

  if (options.savedLastRoute) {
    localStorage.setItem(getLastVisitedRouteStorageKey('user-a'), options.savedLastRoute)
  }

  const syncDeferred = deferred<null>()
  const syncMock = vi.fn(async () => syncDeferred.promise)
  const initializeDatabaseMock = vi.fn(async () => undefined)
  const initializeNotesMock = vi.fn(async () => undefined)
  const authChangeMock = vi.fn(() => vi.fn())

  vi.doMock('vue-router', () => ({
    RouterView: createF7Stub('RouterView'),
    useRouter: () => ({
      currentRoute,
      replace: routerReplaceMock,
      afterEach: vi.fn(() => vi.fn()),
    }),
  }))

  vi.doMock('framework7-vue', () => ({
    f7View: defineComponent({
      name: 'F7View',
      emits: ['view:init'],
      setup(_, { attrs, emit }) {
        onMounted(() => emit('view:init', { router: framework7Router }))
        return () => h('div', attrs)
      },
    }),
  }))

  vi.doMock('@/entities/auth', () => ({
    authService: {
      isAuthenticated: () => options.isAuthenticated ?? true,
      getCurrentAuthUser: () => ((options.isAuthenticated ?? true) ? { id: 'user-a' } : null),
      onAuthChange: authChangeMock,
    },
  }))

  vi.doMock('@/shared/api/pocketbase', () => ({
    PocketBaseRealtimeService: class {},
    authService: {
      isAuthenticated: () => options.isAuthenticated ?? true,
      getCurrentAuthUser: () => ((options.isAuthenticated ?? true) ? { id: 'user-a' } : null),
      onAuthChange: authChangeMock,
    },
  }))

  vi.doMock('@/processes/session/model/auth-manager', async () => ({
    authManager: {
      setAuthService: vi.fn(),
      initialize: vi.fn(async () => undefined),
      isAuthenticated: () => options.isAuthenticated ?? true,
      userInfo: ref((options.isAuthenticated ?? true) ? { id: 'user-a' } : null),
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

  vi.doMock('@/shared/lib/logger', () => ({
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  }))

  vi.doMock('@/shared/ui/f7', () => ({
    F7App: createF7Stub('F7App'),
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

  it('unblocks a direct private detail route once local context is ready', async () => {
    const { wrapper, mocks } = await mountAppForRouteRestore({
      currentPath: '/n/private-note',
      currentName: 'NoteDetail',
      savedLastRoute: '/n/private-note',
    })

    expect(mocks.initializeDatabaseMock).toHaveBeenCalled()
    expect(mocks.initializeNotesMock).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="app-private-route-pending"]').exists()).toBe(false)
    expect(mocks.routerReplaceMock).not.toHaveBeenCalledWith('/n/private-note')

    mocks.syncDeferred.reject(new Error('offline'))
    await flushPromises()
    await nextTick()

    expect(mocks.routerReplaceMock).not.toHaveBeenCalledWith('/home')
  })

  it('keeps an explicit private detail route instead of restoring /home', async () => {
    const { mocks } = await mountAppForRouteRestore({
      currentPath: '/n/private-note',
      currentName: 'NoteDetail',
      savedLastRoute: '/home',
    })

    expect(mocks.routerReplaceMock).not.toHaveBeenCalledWith('/home')
  })

  it('defers restoring a saved private detail until sync bootstrap completes', async () => {
    const { wrapper, mocks } = await mountAppForRouteRestore({
      currentPath: '/home',
      currentName: 'Home',
      savedLastRoute: '/n/private-note',
    })

    expect(wrapper.find('[data-testid="app-private-route-pending"]').exists()).toBe(false)
    expect(mocks.routerReplaceMock).not.toHaveBeenCalledWith('/n/private-note')

    mocks.syncDeferred.resolve(null)
    await flushPromises()
    await nextTick()

    expect(mocks.routerReplaceMock).toHaveBeenCalledWith('/n/private-note')
  })
})
