/// <reference types="vite/client" />

interface Window {
  version: string
  threshold: number
  __VCONSOLE__?: unknown
  __VUE_APP__?: unknown
  __FAST_NOTE_ROUTE_DEBUG__?: {
    state: {
      currentRoute: {
        name?: string | symbol | null
        path: string
        fullPath: string
        hash: string
        params: Record<string, unknown>
        query: Record<string, unknown>
        matched: string[]
      }
      lastTransition: {
        timestamp: number
        to: unknown
        from: unknown
        failure: string | null
        navigationHistory: Array<{
          path: string
          timestamp: number
        }>
      } | null
      transitions: Array<{
        timestamp: number
        to: unknown
        from: unknown
        failure: string | null
        navigationHistory: Array<{
          path: string
          timestamp: number
        }>
      }>
    }
    getNavigationHistory: () => Array<{
      path: string
      timestamp: number
    }>
    printSnapshot: () => void
  }
}
