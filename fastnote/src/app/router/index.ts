import type { Router as Framework7RouterNamespace } from 'framework7/types'
import { disposeUserPublicNotes } from '@/entities/public-note'
import { registerRouterDependencies } from '@/processes/navigation'
import { setFramework7Router, useAppRouter } from '@/shared/lib/framework7'
import { appRoutes } from './routes'

const publicRouteNames = new Set(['UserHome', 'UserFolder', 'UserNote'])

export function initializeFramework7Router(router: Framework7RouterNamespace.Router) {
  setFramework7Router(router)
  const appRouter = useAppRouter()
  registerRouterDependencies(appRouter)

  appRouter.afterEach((to, from) => {
    const previousUsername = publicRouteNames.has(from.name || '')
      ? from.params.username as string | undefined
      : undefined
    const nextUsername = publicRouteNames.has(to.name || '')
      ? to.params.username as string | undefined
      : undefined

    if (previousUsername && previousUsername !== nextUsername)
      disposeUserPublicNotes(previousUsername)
  })
}

export { appRoutes }
