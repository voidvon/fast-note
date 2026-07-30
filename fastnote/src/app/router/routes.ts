import type { RouteRecordRaw } from 'vue-router'
import PrivateFolderRoute from './ui/private-folder-route.vue'
import PrivateNoteRoute from './ui/private-note-route.vue'
import PublicFolderRoute from './ui/public-folder-route.vue'
import PublicNoteRoute from './ui/public-note-route.vue'

export const appRoutes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('@/pages/home'),
  },
  {
    path: '/n/:id',
    component: PrivateNoteRoute,
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/login'),
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/pages/register'),
  },
  {
    path: '/:username/f/:pathMatch(.*)*',
    name: 'UserFolder',
    component: PublicFolderRoute,
  },
  {
    path: '/:username/n/:noteId',
    name: 'UserNote',
    component: PublicNoteRoute,
  },
  {
    path: '/:username',
    name: 'UserHome',
    component: () => import('@/pages/user-public-notes'),
  },
  {
    path: '/f/:pathMatch(.*)*',
    name: 'Folder',
    component: PrivateFolderRoute,
  },
  {
    path: '/deleted',
    component: () => import('@/pages/deleted'),
  },
]
