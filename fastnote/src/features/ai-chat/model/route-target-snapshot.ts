import type { AiChatRequestContext } from './request-context'

export interface AiAgentRouteTargetSnapshot {
  folderId: string
  noteId: string
  overlayMode: 'ai'
  parentId: string
  routePath: string
}

function normalizeRoutePath(path: string) {
  const normalized = path.trim() || '/home'
  return normalized === '/' ? '/home' : normalized
}

function parseRoutePath(routePath: string) {
  const fallbackBase = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  const url = new URL(routePath, fallbackBase)
  const normalizedPath = normalizeRoutePath(url.pathname)

  if (normalizedPath.startsWith('/n/')) {
    return {
      folderId: '',
      noteId: decodeURIComponent(normalizedPath.slice(3)),
      parentId: url.searchParams.get('parent_id') || '',
      routePath: `${normalizedPath}${url.search}`,
    }
  }

  if (normalizedPath.startsWith('/f/')) {
    const decodedPath = decodeURIComponent(normalizedPath.slice(3)).replace(/\/+$/, '')
    const segments = decodedPath.split('/').filter(Boolean)
    return {
      folderId: segments.at(-1) || '',
      noteId: '',
      parentId: '',
      routePath: `${normalizedPath}${url.search}`,
    }
  }

  return {
    folderId: normalizedPath === '/deleted' ? 'deleted' : normalizedPath === '/home' ? 'allnotes' : '',
    noteId: '',
    parentId: url.searchParams.get('parent_id') || '',
    routePath: `${normalizedPath}${url.search}`,
  }
}

export function createRouteTargetSnapshot(context: AiChatRequestContext | null | undefined): AiAgentRouteTargetSnapshot | null {
  const routePath = context?.routePath?.trim() || ''
  if (!routePath) {
    return null
  }

  const parsed = parseRoutePath(routePath)
  return {
    ...parsed,
    overlayMode: 'ai',
  }
}

export function readCurrentRouteTargetSnapshot(): AiAgentRouteTargetSnapshot | null {
  if (typeof window === 'undefined') {
    return null
  }

  const parsed = parseRoutePath(`${window.location.pathname}${window.location.search}`)
  return {
    ...parsed,
    overlayMode: 'ai',
  }
}

export function isRouteTargetSnapshotMatched(
  expected: AiAgentRouteTargetSnapshot | null | undefined,
  current: AiAgentRouteTargetSnapshot | null | undefined,
) {
  if (!expected || !current) {
    return true
  }

  if (expected.noteId) {
    return expected.noteId === current.noteId
      && expected.parentId === current.parentId
      && current.routePath.startsWith('/n/')
  }

  if (expected.folderId) {
    return expected.folderId === current.folderId && !current.noteId
  }

  return expected.routePath === current.routePath
}
