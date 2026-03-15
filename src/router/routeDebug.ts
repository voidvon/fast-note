import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { isNavigationFailure } from 'vue-router'
import { useNavigationHistory } from '@/hooks/useNavigationHistory'

interface SerializedRoute {
  name?: string | symbol | null
  path: string
  fullPath: string
  hash: string
  params: Record<string, unknown>
  query: Record<string, unknown>
  matched: string[]
}

interface SerializedHistoryItem {
  path: string
  timestamp: number
}

interface RouteTransitionSnapshot {
  timestamp: number
  to: SerializedRoute
  from: SerializedRoute
  failure: string | null
  navigationHistory: SerializedHistoryItem[]
}

interface RouteDebugState {
  currentRoute: SerializedRoute
  lastTransition: RouteTransitionSnapshot | null
  transitions: RouteTransitionSnapshot[]
}

interface RouteDebugApi {
  state: RouteDebugState
  getNavigationHistory: () => SerializedHistoryItem[]
  printSnapshot: () => void
}

const MAX_TRANSITIONS = 20

function serializeRoute(route: RouteLocationNormalizedLoaded): SerializedRoute {
  return {
    name: route.name,
    path: route.path,
    fullPath: route.fullPath,
    hash: route.hash,
    params: { ...route.params },
    query: { ...route.query },
    matched: route.matched.map(record => String(record.name || record.path)),
  }
}

function cloneHistoryItem(item: { path: string, timestamp: number }): SerializedHistoryItem {
  return {
    path: item.path,
    timestamp: item.timestamp,
  }
}

export function setupRouteDebug(router: Router) {
  if (typeof window === 'undefined')
    return

  const { getHistory } = useNavigationHistory()
  const getNavigationHistorySnapshot = () => getHistory.value.map(cloneHistoryItem)

  const state: RouteDebugState = {
    currentRoute: serializeRoute(router.currentRoute.value),
    lastTransition: null,
    transitions: [],
  }

  const api: RouteDebugApi = {
    state,
    getNavigationHistory: getNavigationHistorySnapshot,
    printSnapshot() {
      console.warn('[route-debug] snapshot', {
        currentRoute: state.currentRoute,
        lastTransition: state.lastTransition,
        navigationHistory: getNavigationHistorySnapshot(),
      })
    },
  }

  window.__FAST_NOTE_ROUTE_DEBUG__ = api

  console.warn('[route-debug] initialized', {
    currentRoute: state.currentRoute,
    navigationHistory: getNavigationHistorySnapshot(),
  })

  router.afterEach((to, from, failure) => {
    const transition: RouteTransitionSnapshot = {
      timestamp: Date.now(),
      to: serializeRoute(to),
      from: serializeRoute(from),
      failure: failure ? (isNavigationFailure(failure) ? 'navigation-failure' : String(failure)) : null,
      navigationHistory: getNavigationHistorySnapshot(),
    }

    state.currentRoute = transition.to
    state.lastTransition = transition
    state.transitions = [...state.transitions.slice(-(MAX_TRANSITIONS - 1)), transition]

    console.warn('[route-debug] navigation', transition)
  })
}
