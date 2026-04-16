export { registerRouterDependencies } from './model/register-router-dependencies'
export {
  createDesktopActiveNoteSnapshot,
  DESKTOP_ACTIVE_NOTE_STORAGE_PREFIX,
  getDesktopActiveNoteStorageKey,
  getDesktopFolderRoutePath,
  getDesktopNoteRoutePath,
  getDesktopNotesForFolder,
  isDesktopFolderAvailable,
  isPersistableDesktopNoteId,
  normalizeDesktopActiveNoteSnapshot,
  resolveDesktopActiveNoteSelection,
  useDesktopActiveNote,
} from './model/use-desktop-active-note'
export type {
  DesktopActiveNoteSelection,
  DesktopActiveNoteSnapshot,
} from './model/use-desktop-active-note'
export {
  getLastVisitedRouteStorageKey,
  getRouteRestoreMode,
  isDeferredPrivateRoute,
  LAST_ROUTE_STORAGE_PREFIX,
  shouldRestoreLastVisitedRouteForCurrentPath,
  useLastVisitedRoute,
} from './model/use-last-visited-route'
export type { RouteRestoreMode } from './model/use-last-visited-route'
export {
  NAVIGATION_HISTORY_STORAGE_KEY,
  useNavigationHistory,
} from './model/use-navigation-history'
export {
  createRouteStateRestoreManager,
  useRouteStateRestore,
} from './model/use-route-state-restore'
export type {
  FolderEnterMode,
  NavigationType,
  RouteKind,
} from './model/use-route-state-restore'
export {
  useFolderBackButton,
  useNoteBackButton,
  useSimpleBackButton,
} from './model/use-smart-back-button'
