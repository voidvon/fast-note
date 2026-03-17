import type { RouteLocationNormalized } from 'vue-router'
import { ensurePublicNotesReady } from './ensure-public-notes-ready'

const publicRouteNames = new Set(['UserHome', 'UserFolder', 'UserNote'])

export function shouldRedirectDesktopNoteRoute(path: string, viewportWidth: number) {
  const isDesktop = viewportWidth >= 640
  return isDesktop && (path.startsWith('/n/') || path.startsWith('/f/'))
}

export async function ensurePublicNotesRouteReady(to: RouteLocationNormalized) {
  if (!publicRouteNames.has(to.name as string) || !to.params.username)
    return

  const username = to.params.username as string
  await ensurePublicNotesReady(username)
}
