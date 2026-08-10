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

const route = reactive<AppRouteLocation>(normalizeRoute())
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

function replaceFramework7BrowserState(router: Framework7Router, targetUrl: string) {
  const viewId = (router.view as typeof router.view & { id: string }).id
  const viewState = window.history.state?.[viewId]
  window.history.replaceState({
    ...window.history.state,
    [viewId]: {
      ...(viewState && typeof viewState === 'object' ? viewState : {}),
      url: targetUrl,
    },
  }, '', targetUrl)
}

function waitForPageToSettle(pageElement: HTMLElement) {
  return new Promise<void>((resolve) => {
    let quietTimer = window.setTimeout(finish, 80)
    const timeout = window.setTimeout(finish, 500)
    const observer = new MutationObserver(() => {
      window.clearTimeout(quietTimer)
      quietTimer = window.setTimeout(finish, 80)
    })

    function finish() {
      observer.disconnect()
      window.clearTimeout(quietTimer)
      window.clearTimeout(timeout)
      resolve()
    }

    observer.observe(pageElement, { childList: true, subtree: true })
  })
}

async function preloadBackTarget(router: Framework7Router, targetUrl: string) {
  const pageElement = await new Promise<HTMLElement | undefined>((resolve) => {
    let timeout = 0
    const handlePageInit = (page: Framework7RouterNamespace.Page) => {
      if (page.route.url !== targetUrl)
        return

      window.clearTimeout(timeout)
      router.off('pageInit', handlePageInit)
      resolve(page.el)
    }
    timeout = window.setTimeout(() => {
      router.off('pageInit', handlePageInit)
      resolve(undefined)
    }, 1000)
    const preloadOptions = {
      animate: false,
      browserHistory: false,
      force: true,
      preload: true,
    }

    router.on('pageInit', handlePageInit)
    router.back(targetUrl, preloadOptions)
  })

  if (pageElement)
    await waitForPageToSettle(pageElement)

  return pageElement !== undefined
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
      router.navigate(buildTargetUrl(target), { animate: true, reloadCurrent: true })
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
    backTo: async (target: string | AppRouteTarget) => {
      const router = await getRouter()
      const targetUrl = buildTargetUrl(target)
      const previousUrl = router.history[router.history.length - 2]

      if (previousUrl === targetUrl) {
        replaceFramework7BrowserState(router, targetUrl)
        router.back(undefined, { animate: true, browserHistory: false })
        return
      }

      const currentUrl = router.currentRoute.url
      const originalHistory = [...router.history]
      const targetIndex = originalHistory.lastIndexOf(targetUrl)
      const targetHistory = targetIndex >= 0
        ? originalHistory.slice(0, targetIndex + 1)
        : [targetUrl]
      const preloaded = await preloadBackTarget(router, targetUrl)

      if (!preloaded) {
        const fallbackOptions = {
          animate: true,
          force: true,
          replaceState: true,
        }
        router.back(targetUrl, fallbackOptions)
        return
      }

      router.history.splice(0, router.history.length, ...targetHistory, currentUrl)
      replaceFramework7BrowserState(router, targetUrl)
      router.back(undefined, { animate: true, browserHistory: false })
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
