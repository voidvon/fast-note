import type { Router } from 'vue-router'
import { onBeforeUnmount } from 'vue'
import { createScopedStorageKey } from '@/shared/lib/user-scope'

export type RouteRestoreMode = 'all' | 'deferred' | 'immediate'

export const LAST_ROUTE_STORAGE_PREFIX = 'flashnote_last_visited_route'

export function getLastVisitedRouteStorageKey(userId?: string | null) {
  return createScopedStorageKey(LAST_ROUTE_STORAGE_PREFIX, userId)
}

export function isDeferredPrivateRoute(_path: string) {
  return false
}

export function getRouteRestoreMode(path: string): Exclude<RouteRestoreMode, 'all'> {
  return isDeferredPrivateRoute(path) ? 'deferred' : 'immediate'
}

export function useLastVisitedRoute() {
  const saveCurrentRoute = (router: Router, userId?: string | null) => {
    const currentRoute = router.currentRoute.value
    if (currentRoute.name !== 'Login' && currentRoute.name !== 'Register') {
      localStorage.setItem(getLastVisitedRouteStorageKey(userId), currentRoute.fullPath)
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
      saveCurrentRoute(router, userId)
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
    setupAutoSave,
  }
}
