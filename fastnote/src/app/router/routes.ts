import type { RouteRecordRaw } from 'vue-router'
import PrivateFolderRoute from './ui/private-folder-route.vue'
import PrivateNoteRoute from './ui/private-note-route.vue'

const loadPublicCenterRoutes = () => import('./ui/public-center-routes')

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
    component: () => loadPublicCenterRoutes().then(routes => routes.PublicFolderRoute),
  },
  {
    path: '/:username/n/:noteId',
    name: 'UserNote',
    component: () => loadPublicCenterRoutes().then(routes => routes.PublicNoteRoute),
  },
  {
    path: '/:username',
    name: 'UserHome',
    component: () => loadPublicCenterRoutes().then(routes => routes.UserPublicNotesRoute),
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
