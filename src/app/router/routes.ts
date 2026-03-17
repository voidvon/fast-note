import type { RouteRecordRaw } from 'vue-router'
import HomePage from '@/pages/home'

export const appRoutes: Array<RouteRecordRaw> = [
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
    component: () => import('@/pages/note-detail'),
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
    component: () => import('@/pages/folder'),
  },
  {
    path: '/:username/n/:noteId',
    name: 'UserNote',
    component: () => import('@/pages/note-detail'),
  },
  {
    path: '/:username',
    name: 'UserHome',
    component: () => import('@/pages/user-public-notes'),
  },
  {
    path: '/f/:pathMatch(.*)*',
    name: 'Folder',
    component: () => import('@/pages/folder'),
  },
  {
    path: '/deleted',
    component: () => import('@/pages/deleted'),
  },
]
