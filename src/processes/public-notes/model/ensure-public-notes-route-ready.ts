import type { RouteLocationNormalized } from 'vue-router'
import { initializeUserPublicNotes } from '@/entities/public-note'
import { useUserPublicNotesSync } from '@/hooks/useUserPublicNotesSync'

const initializedUsers = new Set<string>()
const publicRouteNames = new Set(['UserHome', 'UserFolder', 'UserNote'])

export function shouldRedirectDesktopNoteRoute(path: string, viewportWidth: number) {
  const isDesktop = viewportWidth >= 640
  return isDesktop && (path.startsWith('/n/') || path.startsWith('/f/'))
}

export async function ensurePublicNotesRouteReady(to: RouteLocationNormalized) {
  if (!publicRouteNames.has(to.name as string) || !to.params.username)
    return

  const username = to.params.username as string
  if (initializedUsers.has(username))
    return

  const { syncUserPublicNotes } = useUserPublicNotesSync(username)

  await initializeUserPublicNotes(username)
  await syncUserPublicNotes()

  initializedUsers.add(username)
}
