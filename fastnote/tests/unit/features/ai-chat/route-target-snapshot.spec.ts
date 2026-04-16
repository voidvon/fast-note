import { describe, expect, it } from 'vitest'
import {
  createRouteTargetSnapshot,
  isRouteTargetSnapshotMatched,
} from '@/features/ai-chat/model/route-target-snapshot'

describe('route target snapshot helpers', () => {
  it('creates a note route snapshot from request context', () => {
    const snapshot = createRouteTargetSnapshot({
      routePath: '/n/note-1?parent_id=folder-1',
    })

    expect(snapshot).toEqual({
      routePath: '/n/note-1?parent_id=folder-1',
      noteId: 'note-1',
      folderId: '',
      parentId: 'folder-1',
      overlayMode: 'ai',
    })
  })

  it('matches note snapshots by note id and parent id', () => {
    expect(isRouteTargetSnapshotMatched(
      {
        routePath: '/n/note-1?parent_id=folder-1',
        noteId: 'note-1',
        folderId: '',
        parentId: 'folder-1',
        overlayMode: 'ai',
      },
      {
        routePath: '/n/note-1?parent_id=folder-1',
        noteId: 'note-1',
        folderId: '',
        parentId: 'folder-1',
        overlayMode: 'ai',
      },
    )).toBe(true)
  })

  it('treats different desktop route objects as mismatched', () => {
    expect(isRouteTargetSnapshotMatched(
      {
        routePath: '/f/folder-a',
        noteId: '',
        folderId: 'folder-a',
        parentId: '',
        overlayMode: 'ai',
      },
      {
        routePath: '/n/note-1',
        noteId: 'note-1',
        folderId: '',
        parentId: '',
        overlayMode: 'ai',
      },
    )).toBe(false)
  })
})
