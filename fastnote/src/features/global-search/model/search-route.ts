import type { GlobalSearchInputMode } from './use-global-search'
import type { AppRouteQuery } from '@/shared/lib/framework7'

export const GLOBAL_SEARCH_OVERLAY_QUERY_KEY = 'overlay'
export const GLOBAL_SEARCH_OVERLAY_QUERY_VALUE = 'search'
export const GLOBAL_SEARCH_OVERLAY_MODE_QUERY_KEY = 'overlayMode'
export const GLOBAL_SEARCH_HISTORY_STATE_KEY = 'globalSearchOverlay'

function normalizeQueryValue(value: AppRouteQuery[string]) {
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }

  return value ?? ''
}

export function hasGlobalSearchOverlay(query: AppRouteQuery) {
  return normalizeQueryValue(query[GLOBAL_SEARCH_OVERLAY_QUERY_KEY]) === GLOBAL_SEARCH_OVERLAY_QUERY_VALUE
}

export function getGlobalSearchOverlayMode(query: AppRouteQuery): GlobalSearchInputMode {
  return normalizeQueryValue(query[GLOBAL_SEARCH_OVERLAY_MODE_QUERY_KEY]) === 'ai'
    ? 'ai'
    : 'search'
}

export function withGlobalSearchOverlay(query: AppRouteQuery, mode: GlobalSearchInputMode = 'search') {
  return {
    ...query,
    [GLOBAL_SEARCH_OVERLAY_QUERY_KEY]: GLOBAL_SEARCH_OVERLAY_QUERY_VALUE,
    [GLOBAL_SEARCH_OVERLAY_MODE_QUERY_KEY]: mode,
  }
}

export function withoutGlobalSearchOverlay(query: AppRouteQuery) {
  const nextQuery = {
    ...query,
  }

  delete nextQuery[GLOBAL_SEARCH_OVERLAY_QUERY_KEY]
  delete nextQuery[GLOBAL_SEARCH_OVERLAY_MODE_QUERY_KEY]

  return nextQuery
}

export function withGlobalSearchHistoryState(historyState: unknown) {
  const state = historyState && typeof historyState === 'object'
    ? historyState as Record<string, unknown>
    : {}

  return {
    ...state,
    [GLOBAL_SEARCH_HISTORY_STATE_KEY]: true,
  }
}

export function shouldUseRouteBackForGlobalSearchClose(historyState: unknown) {
  return Boolean(
    historyState
    && typeof historyState === 'object'
    && (historyState as Record<string, unknown>)[GLOBAL_SEARCH_HISTORY_STATE_KEY] === true,
  )
}
