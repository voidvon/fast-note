import type { Router } from 'framework7/types'
import DeletedPage from '@/pages/deleted'
import Framework7PreviewPage from '@/pages/framework7-preview'
import HomePage from '@/pages/home'
import LoginPage from '@/pages/login'
import RegisterPage from '@/pages/register'
import UserPublicNotesPage from '@/pages/user-public-notes'
import PrivateFolderRoute from './ui/private-folder-route.vue'
import PrivateNoteRoute from './ui/private-note-route.vue'
import PublicFolderRoute from './ui/public-folder-route.vue'
import PublicNoteRoute from './ui/public-note-route.vue'

// Erase Vue component public-instance inference at the route boundary. Several
// routed pages compose NoteList and its move modal recursively; exposing those
// inferred component types through appRoutes makes vue-tsc follow the UI cycle.
const routeComponents: Record<string, object> = {
  deleted: DeletedPage,
  framework7Preview: Framework7PreviewPage,
  home: HomePage,
  login: LoginPage,
  publicFolder: PublicFolderRoute,
  publicNote: PublicNoteRoute,
  register: RegisterPage,
  userPublicNotes: UserPublicNotesPage,
}

export const appRoutes: Router.RouteParameters[] = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/home',
    name: 'Home',
    component: routeComponents.home,
  },
  {
    path: '/framework7-preview',
    name: 'Framework7Preview',
    component: routeComponents.framework7Preview,
  },
  {
    path: '/n/:id',
    name: 'NoteDetail',
    component: PrivateNoteRoute,
  },
  {
    path: '/login',
    name: 'Login',
    component: routeComponents.login,
  },
  {
    path: '/register',
    name: 'Register',
    component: routeComponents.register,
  },
  {
    path: '/:username/f/:pathMatch*',
    name: 'UserFolder',
    component: routeComponents.publicFolder,
  },
  {
    path: '/:username/n/:noteId',
    name: 'UserNote',
    component: routeComponents.publicNote,
  },
  {
    path: '/f/:pathMatch*',
    name: 'Folder',
    component: PrivateFolderRoute,
  },
  {
    path: '/deleted',
    name: 'Deleted',
    component: routeComponents.deleted,
  },
  {
    path: '/:username',
    name: 'UserHome',
    component: routeComponents.userPublicNotes,
  },
]
