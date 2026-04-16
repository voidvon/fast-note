import { createRouter, createWebHistory } from '@ionic/vue-router'
import { registerRouterDependencies } from '@/processes/navigation'
import { ensurePublicNotesRouteReady } from '@/processes/public-notes'
import { appRoutes } from './routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: appRoutes,
})

registerRouterDependencies(router)

router.beforeEach(async (to) => {
  try {
    await ensurePublicNotesRouteReady(to)
  }
  catch (error) {
    console.error('初始化用户公开笔记失败:', error)
  }

  return true
})

export default router
