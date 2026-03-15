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

    // 检测后退导航：目标路径在历史中且位置更早
    if (toIndex !== -1 && fromIndex > toIndex) {
      // 截断到目标位置，移除后续历史
      this.history.value = this.history.value.slice(0, toIndex + 1)
      this.saveToStorage()
      return
    }

    // 前进导航：移除已存在的相同路径（避免循环）
    if (toIndex !== -1) {
      this.history.value.splice(toIndex, 1)
    }

    // 添加新路径
    this.addToHistory(toPath)
  }

  private addToHistory(path: string) {
    // 避免连续重复
    const lastItem = this.history.value[this.history.value.length - 1]
    if (lastItem?.path === path) {
      lastItem.timestamp = Date.now()
      this.saveToStorage()
      return
    }

    // 添加新记录
    this.history.value.push({ path, timestamp: Date.now() })

    // 限制长度
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

  private loadFromStorage() {
    try {
      const storage = this.storageType === 'localStorage' ? localStorage : sessionStorage
      const stored = storage.getItem(NAVIGATION_HISTORY_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        this.history.value = Array.isArray(parsed) ? parsed : []
      }
    }
    catch {
      this.history.value = []
    }
  }

  private saveToStorage() {
    try {
      const storage = this.storageType === 'localStorage' ? localStorage : sessionStorage
      storage.setItem(NAVIGATION_HISTORY_STORAGE_KEY, JSON.stringify(this.history.value))
    }
    catch {
      // 静默处理存储错误
    }
  }

  getPreviousRoute(): string | null {
    return this.history.value.length >= 2
      ? this.history.value[this.history.value.length - 2]?.path || null
      : null
  }

  getSmartBackPath(currentRoute: RouteLocationNormalized, fallbackPath: string): string {
    const previousPath = this.getPreviousRoute()
    return (previousPath && previousPath !== currentRoute.fullPath) ? previousPath : fallbackPath
  }

  clearHistory() {
    this.history.value = []
    try {
      const storage = this.storageType === 'localStorage' ? localStorage : sessionStorage
      storage.removeItem(NAVIGATION_HISTORY_STORAGE_KEY)
    }
    catch {
      // 静默处理
    }
  }

  getHistory() {
    return computed(() => [...this.history.value])
  }

  canGoBack() {
    return computed(() => this.history.value.length > 1)
  }
}

const navigationHistory = new NavigationHistory()

export function useNavigationHistory() {
  return {
    setRouter: (router: Router) => navigationHistory.setRouter(router),
    setStorageType: (type: StorageType) => navigationHistory.setStorageType(type),
    getSmartBackPath: (currentRoute: RouteLocationNormalized, fallbackPath: string) =>
      navigationHistory.getSmartBackPath(currentRoute, fallbackPath),
    getPreviousRoute: () => navigationHistory.getPreviousRoute(),
    canGoBack: navigationHistory.canGoBack(),
    getHistory: navigationHistory.getHistory(),
    clearHistory: () => navigationHistory.clearHistory(),
  }
}

export type { StorageType }
