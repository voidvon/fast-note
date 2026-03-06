import { describe, expect, it } from 'vitest'
import { toSearchResultNodes } from '@/components/GlobalSearch/searchResults'
import { makeNote } from '../../factories/note.factory'

describe('search result nodes', () => {
  it('converts searched notes to note list nodes', () => {
    const note = makeNote({
      id: 'search-note-1',
      title: '搜索结果',
      folderName: '全部',
    })

    const nodes = toSearchResultNodes([note])

    expect(nodes).toEqual([
      {
        originNote: note,
        children: [],
        folderName: '全部',
      },
    ])
  })
})
