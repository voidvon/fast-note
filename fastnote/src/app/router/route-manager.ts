import type { Router } from 'framework7/types'

type Framework7Router = Router.Router
type Framework7Route = Router.RouteParameters

class RouteManager {
  private router: Framework7Router | null = null
  private extensionRoutes: Map<string, Framework7Route[]> = new Map()

  setRouter(router: Framework7Router) {
    this.router = router
  }

  registerExtensionRoutes(extensionName: string, routes: Framework7Route[]) {
    if (!this.router) {
      console.warn('路由器未初始化')
      return
    }

    this.extensionRoutes.set(extensionName, routes)

    this.router.routes.push(...routes)

    console.log(`已注册 ${extensionName} 扩展的路由:`, routes)
  }

  unregisterExtensionRoutes(extensionName: string) {
    if (!this.router) {
      console.warn('路由器未初始化')
      return
    }

    const routes = this.extensionRoutes.get(extensionName)
    if (!routes)
      return

    const routeSet = new Set(routes)
    this.router.routes.splice(0, this.router.routes.length, ...this.router.routes.filter(route => !routeSet.has(route)))

    this.extensionRoutes.delete(extensionName)
    console.log(`已移除 ${extensionName} 扩展的路由`)
  }

  hasExtensionRoutes(extensionName: string): boolean {
    return this.extensionRoutes.has(extensionName)
  }

  getExtensionRoutes(extensionName: string): Framework7Route[] | undefined {
    return this.extensionRoutes.get(extensionName)
  }
}

export const routeManager = new RouteManager()
