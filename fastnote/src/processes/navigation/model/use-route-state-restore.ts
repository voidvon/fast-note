import type { Router } from 'vue-router'
import { computed, ref } from 'vue'

export type NavigationType = 'push' | 'pop'
export type RouteKind = 'folder-list' | 'note-detail' | 'home' | 'other'
export type FolderEnterMode = 'restore' | 'reset'

interface RouteTransition {
  fromPath: string
  toPath: string
  navigationType: NavigationType
  timestamp: number
}

function normalizePath(path: string) {
  return path.split('?')[0]?.split('#')[0] || ''
}

function classifyRoute(path: string): RouteKind {
  const normalizedPath = normalizePath(path)

  if (normalizedPath === '/home')
    return 'home'

  if (/^\/f\/.+$/.test(normalizedPath) || /^\/[^/]+\/f\/.+$/.test(normalizedPath))
    return 'folder-list'

  if (/^\/n\/[^/]+$/.test(normalizedPath) || /^\/[^/]+\/n\/[^/]+$/.test(normalizedPath))
    return 'note-detail'

  return 'other'
}

export function createRouteStateRestoreManager() {
  const lastTransition = ref<RouteTransition | null>(null)
  let isPopNavigationPending = false
  let removeAfterEachHook: (() => void) | null = null
  let isPopstateListenerRegistered = false

  const handlePopState = () => {
    isPopNavigationPending = true
  }

  function ensurePopstateListener() {
    if (typeof window === 'undefined' || isPopstateListenerRegistered)
      return

    window.addEventListener('popstate', handlePopState)
    isPopstateListenerRegistered = true
  }

  function consumeNavigationType(): NavigationType {
    if (isPopNavigationPending) {
      isPopNavigationPending = false
      return 'pop'
    }

    return 'push'
  }

  function setRouter(router: Router) {
    removeAfterEachHook?.()
    ensurePopstateListener()

    removeAfterEachHook = router.afterEach((to, from) => {
      if (to.fullPath === from.fullPath)
        return

      lastTransition.value = {
        fromPath: from.fullPath,
        toPath: to.fullPath,
        navigationType: consumeNavigationType(),
        timestamp: Date.now(),
      }
    })
  }

  function resolveFolderEnterMode(path: string): FolderEnterMode {
    if (classifyRoute(path) !== 'folder-list')
      return 'reset'

    const transition = lastTransition.value
    if (!transition)
      return 'reset'

    if (transition.toPath !== path)
      return 'reset'

    return transition.navigationType === 'pop' ? 'restore' : 'reset'
  }

  function shouldSaveFolderLeave(fromPath: string, toPath: string) {
    if (fromPath === toPath)
      return false

    return classifyRoute(fromPath) === 'folder-list'
  }

  function destroy() {
    removeAfterEachHook?.()
    removeAfterEachHook = null
    isPopNavigationPending = false

    if (typeof window !== 'undefined' && isPopstateListenerRegistered) {
      window.removeEventListener('popstate', handlePopState)
      isPopstateListenerRegistered = false
    }
  }

  function reset() {
    lastTransition.value = null
    isPopNavigationPending = false
  }

  return {
    classifyRoute,
    destroy,
    getLastTransition: computed(() => lastTransition.value),
    resolveFolderEnterMode,
    reset,
    setRouter,
    shouldSaveFolderLeave,
  }
}

const routeStateRestoreManager = createRouteStateRestoreManager()

export function useRouteStateRestore() {
  return routeStateRestoreManager
}
