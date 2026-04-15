import type { RouteLocationNormalized, Router } from 'vue-router'
import { computed, ref } from 'vue'

interface HistoryItem {
  path: string
  timestamp: number
}

export const NAVIGATION_HISTORY_STORAGE_KEY = 'app_navigation_history'
const MAX_HISTORY_LENGTH = 15
const TOP_LEVEL_RESERVED_ROUTES = new Set(['home', 'login', 'register', 'deleted'])

type StorageType = 'localStorage' | 'sessionStorage'
type RouteKind = 'note-detail' | 'folder-list' | 'home' | 'public-home' | 'other'

class NavigationHistory {
  private history = ref<HistoryItem[]>([])
  private storageType: StorageType = 'localStorage'

  constructor() {
    this.loadFromStorage()
  }

  setStorageType(type: StorageType) {
    this.storageType = type
    this.loadFromStorage()
  }

  setRouter(router: Router) {
    router.afterEach((to, from) => {
      if (to.fullPath !== from.fullPath) {
        this.handleNavigation(to.fullPath, from.fullPath)
      }
    })
  }

  private handleNavigation(toPath: string, fromPath: string) {
    const toIndex = this.history.value.findIndex(item => item.path === toPath)
    const fromIndex = this.history.value.findIndex(item => item.path === fromPath)

    if (this.shouldReplaceOrphanDetailWithFallback(toPath, fromPath)) {
      this.history.value = [{ path: toPath, timestamp: Date.now() }]
      this.saveToStorage()
      return
    }

    if (toIndex !== -1 && fromIndex > toIndex) {
      this.history.value = this.history.value.slice(0, toIndex + 1)
      this.saveToStorage()
      return
    }

    if (toIndex !== -1) {
      this.history.value.splice(toIndex, 1)
    }

    this.addToHistory(toPath)
  }

  private addToHistory(path: string) {
    const lastItem = this.history.value[this.history.value.length - 1]
    if (lastItem?.path === path) {
      lastItem.timestamp = Date.now()
      this.saveToStorage()
      return
    }

    this.history.value.push({ path, timestamp: Date.now() })

    if (this.history.value.length > MAX_HISTORY_LENGTH) {
      this.history.value = this.history.value.slice(-MAX_HISTORY_LENGTH)
    }

    this.saveToStorage()
  }

  private normalizePath(path: string) {
    return path.split('?')[0]?.split('#')[0] || ''
  }

  private classifyRoute(path: string): RouteKind {
    const normalizedPath = this.normalizePath(path)

    if (normalizedPath === '/home')
      return 'home'

    if (/^\/f\/.+$/.test(normalizedPath) || /^\/[^/]+\/f\/.+$/.test(normalizedPath))
      return 'folder-list'

    if (/^\/n\/[^/]+$/.test(normalizedPath) || /^\/[^/]+\/n\/[^/]+$/.test(normalizedPath))
      return 'note-detail'

    const topLevelSegment = normalizedPath.replace(/^\//, '')
    if (topLevelSegment && !topLevelSegment.includes('/') && !TOP_LEVEL_RESERVED_ROUTES.has(topLevelSegment))
      return 'public-home'

    return 'other'
  }

  private shouldReplaceOrphanDetailWithFallback(toPath: string, fromPath: string) {
    if (this.history.value.length !== 1)
      return false

    if (this.history.value[0]?.path !== fromPath)
      return false

    if (this.classifyRoute(fromPath) !== 'note-detail')
      return false

    const targetKind = this.classifyRoute(toPath)
    return targetKind === 'folder-list' || targetKind === 'home' || targetKind === 'public-home'
  }

  private saveToStorage() {
    this.storage.setItem(NAVIGATION_HISTORY_STORAGE_KEY, JSON.stringify(this.history.value))
  }

  private loadFromStorage() {
    try {
      const stored = this.storage.getItem(NAVIGATION_HISTORY_STORAGE_KEY)
      this.history.value = stored ? JSON.parse(stored) : []
    }
    catch {
      this.history.value = []
    }
  }

  private get storage() {
    return this.storageType === 'sessionStorage' ? sessionStorage : localStorage
  }

  getHistory() {
    return this.history
  }

  getPreviousRoute(currentPath: string): string | null {
    const currentIndex = this.history.value.findIndex(item => item.path === currentPath)
    if (currentIndex > 0) {
      return this.history.value[currentIndex - 1]?.path || null
    }
    return null
  }

  getSmartBackPath(route: RouteLocationNormalized, fallbackPath: string) {
    const previousPath = this.getPreviousRoute(route.fullPath)

    if (!previousPath || previousPath === route.fullPath) {
      return fallbackPath
    }

    return previousPath
  }

  clearHistory() {
    this.history.value = []
    this.saveToStorage()
  }
}

const navigationHistory = new NavigationHistory()

export function useNavigationHistory() {
  return {
    history: computed(() => navigationHistory.getHistory().value),
    setStorageType: (type: StorageType) => navigationHistory.setStorageType(type),
    setRouter: (router: Router) => navigationHistory.setRouter(router),
    getPreviousRoute: (currentPath: string) => navigationHistory.getPreviousRoute(currentPath),
    getSmartBackPath: (route: RouteLocationNormalized, fallbackPath: string) =>
      navigationHistory.getSmartBackPath(route, fallbackPath),
    clearHistory: () => navigationHistory.clearHistory(),
  }
}
