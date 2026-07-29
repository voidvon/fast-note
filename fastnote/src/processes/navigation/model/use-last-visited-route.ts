import type { Router } from 'vue-router'
import { onBeforeUnmount } from 'vue'
import { createScopedStorageKey } from '@/shared/lib/user-scope'

export type RouteRestoreMode = 'all' | 'deferred' | 'immediate'

export const LAST_ROUTE_STORAGE_PREFIX = 'flashnote_last_visited_route'

const PRIVATE_NOTE_ROUTE_PATTERN = /^\/n\/([^/?#]+)(?:[?#].*)?$/
const PRIVATE_FOLDER_ROUTE_PATTERN = /^\/f(?:\/|$)/
const ROUTE_RESTORE_ENTRY_PATHS = new Set(['/', '/home', '/login', '/register'])
const PRIVATE_WORKSPACE_STATIC_PATHS = new Set(['/home', '/deleted'])

function getBrowserFullPath() {
  if (typeof window === 'undefined')
    return ''

  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function getLastVisitedRouteStorageKey(userId?: string | null) {
  return createScopedStorageKey(LAST_ROUTE_STORAGE_PREFIX, userId)
}

export function isDeferredPrivateRoute(path: string) {
  const match = path.match(PRIVATE_NOTE_ROUTE_PATTERN)
  if (!match) {
    return false
  }

  return match[1] !== '0'
}

export function getRouteRestoreMode(path: string): Exclude<RouteRestoreMode, 'all'> {
  return isDeferredPrivateRoute(path) ? 'deferred' : 'immediate'
}

export function isPrivateWorkspaceRoute(path: string) {
  const normalizedPath = path.split('?')[0]?.split('#')[0] || ''
  return PRIVATE_WORKSPACE_STATIC_PATHS.has(normalizedPath)
    || PRIVATE_NOTE_ROUTE_PATTERN.test(path)
    || PRIVATE_FOLDER_ROUTE_PATTERN.test(normalizedPath)
}

export function shouldRestoreLastVisitedRouteForCurrentPath(path: string) {
  const normalizedPath = path.split('?')[0]?.split('#')[0] || ''
  return ROUTE_RESTORE_ENTRY_PATHS.has(normalizedPath)
}

export function useLastVisitedRoute() {
  const saveVisitedRoute = (fullPath: string, userId?: string | null) => {
    if (!fullPath || !isPrivateWorkspaceRoute(fullPath))
      return

    localStorage.setItem(getLastVisitedRouteStorageKey(userId), fullPath)
  }

  const saveCurrentRoute = (router: Router, userId?: string | null) => {
    const currentRoute = router.currentRoute.value
    if (currentRoute.name !== 'Login' && currentRoute.name !== 'Register') {
      saveVisitedRoute(currentRoute.fullPath, userId)
    }
  }

  const getLastVisitedRoute = (userId?: string | null): string | null => {
    return localStorage.getItem(getLastVisitedRouteStorageKey(userId))
  }

  const clearLastVisitedRoute = (userId?: string | null) => {
    localStorage.removeItem(getLastVisitedRouteStorageKey(userId))
  }

  const restoreLastVisitedRoute = async (router: Router, userId?: string | null, mode: RouteRestoreMode = 'all') => {
    const lastRoute = getLastVisitedRoute(userId)
    if (!lastRoute)
      return null

    if (!isPrivateWorkspaceRoute(lastRoute)) {
      clearLastVisitedRoute(userId)
      return null
    }

    if (mode !== 'all' && getRouteRestoreMode(lastRoute) !== mode)
      return null

    if (lastRoute !== router.currentRoute.value.fullPath) {
      await router.replace(lastRoute)
    }

    return lastRoute
  }

  const restoreImmediateLastVisitedRoute = (router: Router, userId?: string | null) => {
    return restoreLastVisitedRoute(router, userId, 'immediate')
  }

  const restoreDeferredLastVisitedRoute = (router: Router, userId?: string | null) => {
    return restoreLastVisitedRoute(router, userId, 'deferred')
  }

  const setupAutoSave = (router: Router, userId?: string | null) => {
    const unwatch = router.afterEach(() => {
      saveCurrentRoute(router, userId)
    })

    const handleBeforeUnload = () => {
      saveVisitedRoute(getBrowserFullPath() || router.currentRoute.value.fullPath, userId)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    onBeforeUnmount(() => {
      unwatch()
      window.removeEventListener('beforeunload', handleBeforeUnload)
    })
  }

  return {
    clearLastVisitedRoute,
    getLastVisitedRoute,
    getRouteRestoreMode,
    isDeferredPrivateRoute,
    restoreDeferredLastVisitedRoute,
    restoreImmediateLastVisitedRoute,
    restoreLastVisitedRoute,
    saveCurrentRoute,
    saveVisitedRoute,
    shouldRestoreLastVisitedRouteForCurrentPath,
    setupAutoSave,
  }
}
