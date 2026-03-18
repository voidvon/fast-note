import type { Router } from 'vue-router'
import { routeManager } from '@/app/router/route-manager'
import { useNavigationHistory } from './use-navigation-history'
import { useRouteStateRestore } from './use-route-state-restore'

export function registerRouterDependencies(router: Router) {
  const { setRouter } = useNavigationHistory()
  setRouter(router)

  const { setRouter: setRouteStateRestoreRouter } = useRouteStateRestore()
  setRouteStateRestoreRouter(router)

  routeManager.setRouter(router)
}
