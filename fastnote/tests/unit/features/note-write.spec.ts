import { describe, expect, it, vi } from 'vitest'
import { useNoteWrite } from '@/features/note-write'
import { NOTE_TYPE } from '@/shared/types'

describe('useNoteWrite', () => {
  it('creates folders with a default title and updates parent counters', async () => {
    const addNote = vi.fn(async note => note)
    const updateParentFolderSubcount = vi.fn(async () => undefined)
    const api = useNoteWrite({
      addNote,
      getNote: vi.fn(),
      updateNote: vi.fn(),
      updateParentFolderSubcount,
      createId: () => 'folder-1',
      getNow: () => '2026-03-20 10:00:00',
    })

    const result = await api.createNote({
      itemType: NOTE_TYPE.FOLDER,
      parentId: 'root-folder',
    })

    expect(result).toMatchObject({
      ok: true,
      code: 'ok',
      note: expect.objectContaining({
        id: 'folder-1',
        title: '新建文件夹',
        item_type: NOTE_TYPE.FOLDER,
        parent_id: 'root-folder',
      }),
    })
    expect(addNote).toHaveBeenCalledTimes(1)
    expect(updateParentFolderSubcount).toHaveBeenCalledWith(expect.objectContaining({
      id: 'folder-1',
    }))
  })

  it('rejects updates when the caller holds a stale updated timestamp', async () => {
    const api = useNoteWrite({
      addNote: vi.fn(),
      getNote: vi.fn(async () => ({
        id: 'note-1',
        title: '旧标题',
        summary: '旧摘要',
        content: '<p>旧内容</p>',
        created: '2026-03-20 09:00:00',
        updated: '2026-03-20 09:30:00',
        item_type: NOTE_TYPE.NOTE,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        version: 2,
        files: [],
      })),
      updateNote: vi.fn(),
      updateParentFolderSubcount: vi.fn(),
    })

    const result = await api.updateNote({
      noteId: 'note-1',
      title: '新标题',
      expectedUpdated: '2026-03-20 08:00:00',
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'version_conflict',
    })
  })
})
