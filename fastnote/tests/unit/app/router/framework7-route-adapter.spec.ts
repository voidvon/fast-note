type RouteEvent = 'routeChange' | 'routeChanged'
type RouteHandler = (route: { url: string }) => void

function createRouter(initialUrl: string) {
  const handlers = new Map<RouteEvent, Set<RouteHandler>>()
  const on = vi.fn((event: RouteEvent, handler: RouteHandler) => {
    const eventHandlers = handlers.get(event) || new Set<RouteHandler>()
    eventHandlers.add(handler)
    handlers.set(event, eventHandlers)
  })
  const off = vi.fn((event: RouteEvent, handler: RouteHandler) => {
    handlers.get(event)?.delete(handler)
  })

  return {
    router: {
      currentRoute: { url: initialUrl },
      on,
      off,
      navigate: vi.fn(),
      back: vi.fn(),
    },
    emit(event: RouteEvent, url: string) {
      handlers.get(event)?.forEach(handler => handler({ url }))
    },
    on,
    off,
  }
}

describe('framework7 route adapter', () => {
  beforeEach(() => {
    vi.resetModules()
    window.history.replaceState({}, '', '/home')
  })

  it('parses a direct public profile URL before Framework7 is ready', async () => {
    window.history.replaceState({}, '', '/voidvon')

    const { useAppRoute } = await import('@/shared/lib/framework7/router')

    expect(useAppRoute().name).toBe('UserHome')
    expect(useAppRoute().params.username).toBe('voidvon')
  })

  it('exposes incoming route params as soon as routeChange starts', async () => {
    const { setFramework7Router, useAppRoute, useAppRouter } = await import('@/shared/lib/framework7/router')
    const fake = createRouter('/home')
    setFramework7Router(fake.router as unknown as Parameters<typeof setFramework7Router>[0])

    expect(useAppRoute().name).toBe('Home')

    const afterEach = vi.fn()
    useAppRouter().afterEach(afterEach)
    fake.emit('routeChange', '/f/local-folder')

    expect(useAppRoute().name).toBe('Folder')
    expect(useAppRoute().params.pathMatch).toEqual(['local-folder'])
    expect(afterEach).toHaveBeenCalledTimes(1)

    fake.emit('routeChanged', '/f/local-folder')
    expect(afterEach).toHaveBeenCalledTimes(1)

    fake.emit('routeChange', '/n/local-note')
    expect(useAppRoute().name).toBe('NoteDetail')
    expect(useAppRoute().params.id).toBe('local-note')
    expect(afterEach).toHaveBeenCalledTimes(2)

    fake.emit('routeChanged', '/n/local-note')
    expect(afterEach).toHaveBeenCalledTimes(2)
  })

  it('detaches both route listeners when the Framework7 router is replaced', async () => {
    const { setFramework7Router } = await import('@/shared/lib/framework7/router')
    const first = createRouter('/home')
    const second = createRouter('/f/second-folder')

    setFramework7Router(first.router as unknown as Parameters<typeof setFramework7Router>[0])
    setFramework7Router(second.router as unknown as Parameters<typeof setFramework7Router>[0])

    expect(first.off).toHaveBeenCalledTimes(2)
    expect(first.off).toHaveBeenCalledWith('routeChange', expect.any(Function))
    expect(first.off).toHaveBeenCalledWith('routeChanged', expect.any(Function))
    expect(second.on).toHaveBeenCalledWith('routeChange', expect.any(Function))
    expect(second.on).toHaveBeenCalledWith('routeChanged', expect.any(Function))
  })

  it('updates query-only UI state without rebuilding the Framework7 page', async () => {
    const { setFramework7Router, useAppRoute, useAppRouter } = await import('@/shared/lib/framework7/router')
    const fake = createRouter('/home')
    setFramework7Router(fake.router as unknown as Parameters<typeof setFramework7Router>[0])

    const router = useAppRouter()
    router.pushQueryState({
      path: '/home',
      query: {
        overlay: 'search',
        overlayMode: 'search',
      },
      state: {
        globalSearchOverlay: true,
      },
    })

    expect(window.location.search).toBe('?overlay=search&overlayMode=search')
    expect(useAppRoute().query).toEqual({
      overlay: 'search',
      overlayMode: 'search',
    })
    expect(window.history.state.globalSearchOverlay).toBe(true)
    expect(fake.router.navigate).not.toHaveBeenCalled()

    router.replaceQueryState({ path: '/home', query: {} })

    expect(window.location.search).toBe('')
    expect(useAppRoute().query).toEqual({})
    expect(fake.router.navigate).not.toHaveBeenCalled()
  })

  it('backs to an explicit route without consuming stale browser history', async () => {
    const { setFramework7Router, useAppRouter } = await import('@/shared/lib/framework7/router')
    const fake = createRouter('/f/parent-folder/current-folder')
    setFramework7Router(fake.router as unknown as Parameters<typeof setFramework7Router>[0])

    await useAppRouter().backTo('/f/parent-folder')

    expect(fake.router.back).toHaveBeenCalledWith('/f/parent-folder', {
      animate: true,
      force: true,
      replaceState: true,
    })
  })
})
