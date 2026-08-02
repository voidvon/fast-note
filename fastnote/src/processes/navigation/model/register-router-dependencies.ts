import type { AppRouter } from '@/shared/lib/framework7'
import { useNavigationHistory } from './use-navigation-history'
import { useRouteStateRestore } from './use-route-state-restore'

export function registerRouterDependencies(router: AppRouter) {
  const { setRouter } = useNavigationHistory()
  setRouter(router)

  const { setRouter: setRouteStateRestoreRouter } = useRouteStateRestore()
  setRouteStateRestoreRouter(router)
}
