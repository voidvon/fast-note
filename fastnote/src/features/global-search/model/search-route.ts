import type { LocationQuery, LocationQueryRaw } from 'vue-router'

export const GLOBAL_SEARCH_OVERLAY_QUERY_KEY = 'overlay'
export const GLOBAL_SEARCH_OVERLAY_QUERY_VALUE = 'search'
export const GLOBAL_SEARCH_HISTORY_STATE_KEY = 'globalSearchOverlay'

function normalizeQueryValue(value: LocationQuery[string] | LocationQueryRaw[string]) {
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }

  return value ?? ''
}

export function hasGlobalSearchOverlay(query: LocationQuery | LocationQueryRaw) {
  return normalizeQueryValue(query[GLOBAL_SEARCH_OVERLAY_QUERY_KEY]) === GLOBAL_SEARCH_OVERLAY_QUERY_VALUE
}

export function withGlobalSearchOverlay(query: LocationQuery | LocationQueryRaw) {
  return {
    ...query,
    [GLOBAL_SEARCH_OVERLAY_QUERY_KEY]: GLOBAL_SEARCH_OVERLAY_QUERY_VALUE,
  }
}

export function withoutGlobalSearchOverlay(query: LocationQuery | LocationQueryRaw) {
  const nextQuery = {
    ...query,
  }

  delete nextQuery[GLOBAL_SEARCH_OVERLAY_QUERY_KEY]

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
