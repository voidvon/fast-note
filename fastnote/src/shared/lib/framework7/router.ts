import type { Router as Framework7RouterNamespace } from 'framework7/types'
import { computed, reactive, ref } from 'vue'

export type AppRouteQuery = Record<string, string | string[] | undefined>
export type AppRouteParams = Record<string, string | string[] | undefined>

export interface AppRouteLocation {
  fullPath: string
  path: string
  query: AppRouteQuery
  params: AppRouteParams
  name?: string
  hash: string
}

export interface AppRouteTarget {
  path?: string
  query?: AppRouteQuery
  hash?: string
  name?: string
  state?: Record<string, unknown>
}

type Framework7Router = Framework7RouterNamespace.Router
type AfterEachHandler = (to: AppRouteLocation, from: AppRouteLocation) => void

const route = reactive<AppRouteLocation>({
  fullPath: getBrowserFullPath(),
  path: typeof window === 'undefined' ? '/home' : window.location.pathname || '/home',
  query: parseQuery(typeof window === 'undefined' ? '' : window.location.search),
  params: {},
  name: undefined,
  hash: typeof window === 'undefined' ? '' : window.location.hash,
})
const routerRef = ref<Framework7Router>()
const afterEachHandlers = new Set<AfterEachHandler>()
let detachRouteEvents: (() => void) | undefined
let resolveRouterReady: ((router: Framework7Router) => void) | undefined
const routerReady = new Promise<Framework7Router>((resolve) => {
  resolveRouterReady = resolve
})
let browserHistoryListenerRegistered = false

function getBrowserFullPath() {
  if (typeof window === 'undefined')
    return '/home'
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || '/home'
}

function parseQuery(search: string) {
  const query: AppRouteQuery = {}
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  params.forEach((value, key) => {
    const previous = query[key]
    if (previous === undefined)
      query[key] = value
    else if (Array.isArray(previous))
      previous.push(value)
    else
      query[key] = [previous, value]
  })
  return query
}

function parseRouteParams(path: string) {
  const params: AppRouteParams = {}
  let name: string | undefined

  if (path === '/home') {
    name = 'Home'
  }
  else if (path === '/login') {
    name = 'Login'
  }
  else if (path === '/register') {
    name = 'Register'
  }
  else if (path === '/framework7-preview') {
    name = 'Framework7Preview'
  }
  else if (path === '/deleted') {
    name = 'Deleted'
  }
  else {
    const privateNote = path.match(/^\/n\/([^/]+)$/)
    const privateFolder = path.match(/^\/f(?:\/(.*))?$/)
    const publicNote = path.match(/^\/([^/]+)\/n\/([^/]+)$/)
    const publicFolder = path.match(/^\/([^/]+)\/f(?:\/(.*))?$/)
    const publicHome = path.match(/^\/([^/]+)$/)

    if (privateNote) {
      name = 'NoteDetail'
      params.id = decodeURIComponent(privateNote[1] || '')
    }
    else if (privateFolder) {
      name = 'Folder'
      params.pathMatch = (privateFolder[1] || '').split('/').filter(Boolean).map(decodeURIComponent)
    }
    else if (publicNote) {
      name = 'UserNote'
      params.username = decodeURIComponent(publicNote[1] || '')
      params.noteId = decodeURIComponent(publicNote[2] || '')
    }
    else if (publicFolder) {
      name = 'UserFolder'
      params.username = decodeURIComponent(publicFolder[1] || '')
      params.pathMatch = (publicFolder[2] || '').split('/').filter(Boolean).map(decodeURIComponent)
    }
    else if (publicHome) {
      name = 'UserHome'
      params.username = decodeURIComponent(publicHome[1] || '')
    }
  }

  return { name, params }
}

function normalizeRoute(source?: Partial<Framework7RouterNamespace.Route> | null): AppRouteLocation {
  const fullPath = source?.url || getBrowserFullPath()
  const url = new URL(fullPath, typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
  const parsed = parseRouteParams(url.pathname)
  return {
    fullPath: `${url.pathname}${url.search}${url.hash}`,
    path: url.pathname,
    query: source?.query ? { ...source.query } : parseQuery(url.search),
    params: { ...parsed.params, ...(source?.params || {}) },
    name: source?.name || parsed.name,
    hash: source?.hash || url.hash,
  }
}

function updateRoute(next: AppRouteLocation) {
  const previous = { ...route, query: { ...route.query }, params: { ...route.params } }
  Object.assign(route, next)
  if (previous.fullPath !== next.fullPath)
    afterEachHandlers.forEach(handler => handler(next, previous))
}

function syncRouteFromBrowser() {
  updateRoute(normalizeRoute())
}

function ensureBrowserHistoryListener() {
  if (browserHistoryListenerRegistered || typeof window === 'undefined')
    return

  browserHistoryListenerRegistered = true
  window.addEventListener('popstate', syncRouteFromBrowser)
}

function buildTargetUrl(target: string | AppRouteTarget) {
  if (typeof target === 'string')
    return target

  const path = target.path || route.path
  const params = new URLSearchParams()
  Object.entries(target.query || {}).forEach(([key, value]) => {
    if (Array.isArray(value))
      value.forEach(item => params.append(key, item))
    else if (value !== undefined)
      params.set(key, value)
  })
  const query = params.toString()
  return `${path}${query ? `?${query}` : ''}${target.hash || ''}`
}

function getRouter() {
  return routerRef.value ? Promise.resolve(routerRef.value) : routerReady
}

export function setFramework7Router(router: Framework7Router) {
  ensureBrowserHistoryListener()
  detachRouteEvents?.()
  routerRef.value = router
  resolveRouterReady?.(router)
  resolveRouterReady = undefined
  updateRoute(normalizeRoute(router.currentRoute))

  const syncRoute = (nextRoute: Framework7RouterNamespace.Route) => {
    updateRoute(normalizeRoute(nextRoute))
  }
  router.on('routeChange', syncRoute)
  router.on('routeChanged', syncRoute)
  detachRouteEvents = () => {
    router.off('routeChange', syncRoute)
    router.off('routeChanged', syncRoute)
  }
}

export function useAppRoute() {
  return route
}

export function useAppRouter() {
  ensureBrowserHistoryListener()

  return {
    currentRoute: computed(() => route),
    push: async (target: string | AppRouteTarget) => {
      const router = await getRouter()
      router.navigate(buildTargetUrl(target), { animate: true })
      if (typeof target !== 'string' && target.state) {
        window.setTimeout(() => {
          window.history.replaceState({ ...window.history.state, ...target.state }, '', window.location.href)
        })
      }
    },
    replace: async (target: string | AppRouteTarget) => {
      const router = await getRouter()
      router.navigate(buildTargetUrl(target), { reloadCurrent: true })
    },
    pushQueryState: (target: AppRouteTarget) => {
      const url = buildTargetUrl(target)
      const state = { ...window.history.state, ...(target.state || {}) }
      window.history.pushState(state, '', url)
      syncRouteFromBrowser()
    },
    replaceQueryState: (target: AppRouteTarget) => {
      const url = buildTargetUrl(target)
      const state = { ...window.history.state, ...(target.state || {}) }
      window.history.replaceState(state, '', url)
      syncRouteFromBrowser()
    },
    backQueryState: () => {
      window.history.back()
    },
    back: async () => {
      const router = await getRouter()
      router.back(undefined, { animate: true })
    },
    navigate: async (path: string, _direction?: string, action?: string) => {
      const router = await getRouter()
      router.navigate(path, action === 'replace'
        ? { animate: true, reloadCurrent: true }
        : { animate: true })
    },
    afterEach: (handler: AfterEachHandler) => {
      afterEachHandlers.add(handler)
      return () => afterEachHandlers.delete(handler)
    },
  }
}

export type AppRouter = ReturnType<typeof useAppRouter>
