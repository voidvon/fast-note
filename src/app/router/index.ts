import { createRouter, createWebHistory } from '@ionic/vue-router'
import { registerRouterDependencies } from '@/processes/navigation/model/register-router-dependencies'
import { ensurePublicNotesRouteReady, shouldRedirectDesktopNoteRoute } from '@/processes/public-notes/model/ensure-public-notes-route-ready'
import { appRoutes } from './routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: appRoutes,
})

registerRouterDependencies(router)

router.beforeEach(async (to) => {
  if (shouldRedirectDesktopNoteRoute(to.path, window.innerWidth)) {
    return '/home'
  }

  try {
    await ensurePublicNotesRouteReady(to)
  }
  catch (error) {
    console.error('初始化用户公开笔记失败:', error)
  }

  return true
})

export default router
