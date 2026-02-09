import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from '@ionic/vue-router'
import { useNavigationHistory } from '@/hooks/useNavigationHistory'
import { useUserPublicNotesSync } from '@/hooks/useUserPublicNotesSync'
import { initializeUserPublicNotes } from '@/stores'
import HomePage from '../views/HomePage.vue'
import { routeManager } from './routeManager'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/home',
    name: 'Home',
    component: HomePage,
  },
  {
    path: '/n/:id',
    component: () => import('../views/NoteDetail.vue'),
  },
  // 认证页面 - 核心路由
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginPage.vue'),
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/RegisterPage.vue'),
  },
  // 用户公开文件夹内部页面
  {
    path: '/:username/f/:pathMatch(.*)*',
    name: 'UserFolder',
    component: () => import('../views/FolderPage.vue'),
  },
  // 用户公开笔记详情页面
  {
    path: '/:username/n/:noteId',
    name: 'UserNote',
    component: () => import('../views/NoteDetail.vue'),
  },
  // 用户公开笔记页面 - 放在具体路径后面，避免拦截其他路由
  {
    path: '/:username',
    name: 'UserHome',
    component: () => import('../views/UserPublicNotesPage.vue'),
  },
  {
    path: '/f/:pathMatch(.*)*',
    name: 'Folder',
    component: () => import('../views/FolderPage.vue'),
  },
  {
    path: '/deleted',
    component: () => import('../views/DeletedPage.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// 初始化导航历史记录
const { setRouter } = useNavigationHistory()
setRouter(router)

// 记录已初始化的用户，避免重复初始化
const initializedUsers = new Set<string>()

// 路由守卫：在进入以 /:username 开头的路由时初始化用户公开笔记
router.beforeEach(async (to, from, next) => {
  // PC 版重定向逻辑：访问 /n/:id 或 /f/:path 时重定向到 /home
  const isDesktop = window.innerWidth >= 640
  if (isDesktop && (to.path.startsWith('/n/') || to.path.startsWith('/f/'))) {
    next('/home')
    return
  }

  // 检查是否是以 /:username 开头的路由
  const usernameRoutes = ['UserHome', 'UserFolder', 'UserNote']

  if (usernameRoutes.includes(to.name as string) && to.params.username) {
    const username = to.params.username as string

    // 只有第一次访问该用户时才进行初始化
    if (!initializedUsers.has(username)) {
      const { syncUserPublicNotes } = useUserPublicNotesSync(username)
      try {
        // 初始化数据库
        await initializeUserPublicNotes(username)
        // 初始化用户、公开笔记数据
        await syncUserPublicNotes()
        // 标记该用户已初始化
        initializedUsers.add(username)
      }
      catch (error) {
        console.error('初始化用户公开笔记失败:', error)
      }
    }
  }

  next()
})

// 初始化路由管理器
routeManager.setRouter(router)

export default router
