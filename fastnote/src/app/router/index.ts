import { createRouter, createWebHistory } from '@ionic/vue-router'
import { disposeUserPublicNotes } from '@/entities/public-note'
import { registerRouterDependencies } from '@/processes/navigation'
import { appRoutes } from './routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: appRoutes,
})

registerRouterDependencies(router)

const publicRouteNames = new Set(['UserHome', 'UserFolder', 'UserNote'])

router.afterEach((to, from) => {
  const previousUsername = publicRouteNames.has(from.name as string)
    ? from.params.username as string | undefined
    : undefined
  const nextUsername = publicRouteNames.has(to.name as string)
    ? to.params.username as string | undefined
    : undefined

  if (previousUsername && previousUsername !== nextUsername) {
    disposeUserPublicNotes(previousUsername)
  }
})

export default router
