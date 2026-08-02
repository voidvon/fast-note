import { describe, expect, it } from 'vitest'
import { buildVirtualNoteRows } from '@/pages/framework7-preview/model/virtual-note-list'
import { makeNote } from '../../factories/note.factory'

describe('framework7 virtual note list', () => {
  it('keeps active notes sorted by updated time', () => {
    const rows = buildVirtualNoteRows([
      makeNote({ id: 'older', title: '较早', updated: '2026-01-01 00:00:00' }),
      makeNote({ id: 'deleted', title: '已删除', is_deleted: 1, updated: '2026-03-01 00:00:00' }),
      makeNote({ id: 'newer', title: '较新', updated: '2026-02-01 00:00:00' }),
    ])

    expect(rows.map(row => row.id)).toEqual(['newer', 'older'])
  })

  it('searches titles and summaries without changing source notes', () => {
    const notes = [
      makeNote({ id: 'title', title: '旅行计划', summary: '上海出发' }),
      makeNote({ id: 'summary', title: '待办事项', summary: '预订机票' }),
    ]

    expect(buildVirtualNoteRows(notes, '机票').map(row => row.id)).toEqual(['summary'])
    expect(notes).toHaveLength(2)
  })
})
