import type { RouteLocationNormalized } from 'vue-router'
import { ensurePublicNotesReady } from './ensure-public-notes-ready'

const publicRouteNames = new Set(['UserHome', 'UserFolder', 'UserNote'])

export async function ensurePublicNotesRouteReady(to: RouteLocationNormalized) {
  if (!publicRouteNames.has(to.name as string) || !to.params.username)
    return

  const username = to.params.username as string
  await ensurePublicNotesReady(username)
}
