import type { Router } from 'vue-router'
import { onBeforeUnmount } from 'vue'

const LAST_ROUTE_KEY = 'flashnote_last_visited_route'

/**
 * 记录和恢复最后访问的路由
 */
export function useLastVisitedRoute() {
  /**
   * 保存当前路由到 localStorage
   */
  const saveCurrentRoute = (router: Router) => {
    const currentRoute = router.currentRoute.value
    // 排除登录和注册页面
    if (currentRoute.name !== 'Login' && currentRoute.name !== 'Register') {
      localStorage.setItem(LAST_ROUTE_KEY, currentRoute.fullPath)
    }
  }

  /**
   * 获取最后访问的路由
   */
  const getLastVisitedRoute = (): string | null => {
    return localStorage.getItem(LAST_ROUTE_KEY)
  }

  /**
   * 清除最后访问的路由记录
   */
  const clearLastVisitedRoute = () => {
    localStorage.removeItem(LAST_ROUTE_KEY)
  }

  /**
   * 恢复到最后访问的路由
   */
  const restoreLastVisitedRoute = async (router: Router) => {
    const lastRoute = getLastVisitedRoute()
    if (lastRoute && lastRoute !== router.currentRoute.value.fullPath) {
      await router.replace(lastRoute)
    }
  }

  /**
   * 在组件卸载时自动保存当前路由
   */
  const setupAutoSave = (router: Router) => {
    // 监听路由变化，实时保存
    const unwatch = router.afterEach(() => {
      saveCurrentRoute(router)
    })

    // 监听页面卸载事件
    const handleBeforeUnload = () => {
      saveCurrentRoute(router)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // 组件卸载时清理
    onBeforeUnmount(() => {
      unwatch()
      window.removeEventListener('beforeunload', handleBeforeUnload)
    })
  }

  return {
    saveCurrentRoute,
    getLastVisitedRoute,
    clearLastVisitedRoute,
    restoreLastVisitedRoute,
    setupAutoSave,
  }
}
