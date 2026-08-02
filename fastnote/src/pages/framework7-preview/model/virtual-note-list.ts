import type { Note } from '@/shared/types'
import { NOTE_TYPE } from '@/shared/types'

export interface VirtualNoteRow {
  id: string
  itemType: Note['item_type']
  title: string
  subtitle: string
  updated: string
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase()
}

export function buildVirtualNoteRows(notes: Note[], query = ''): VirtualNoteRow[] {
  const normalizedQuery = normalizeSearchText(query)

  return notes
    .filter(note => note.is_deleted === 0)
    .filter((note) => {
      if (!normalizedQuery)
        return true

      return normalizeSearchText(`${note.title} ${note.summary ?? ''}`).includes(normalizedQuery)
    })
    .toSorted((left, right) => right.updated.localeCompare(left.updated))
    .map(note => ({
      id: note.id,
      itemType: note.item_type,
      title: note.title || (note.item_type === NOTE_TYPE.FOLDER ? '未命名文件夹' : '未命名备忘录'),
      subtitle: note.item_type === NOTE_TYPE.FOLDER
        ? `${note.note_count ?? 0} 个项目`
        : note.summary?.trim() || '暂无摘要',
      updated: note.updated,
    }))
}
