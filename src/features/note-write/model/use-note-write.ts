import type { Note, NoteType } from '@/shared/types'
import { nanoid } from 'nanoid'
import { getTime } from '@/shared/lib/date'
import { NOTE_TYPE } from '@/shared/types'

type MaybePromise<T> = T | Promise<T>

export interface CreateNoteInput {
  noteId?: string
  title?: string
  summary?: string
  content?: string
  parentId?: string | null
  itemType?: NoteType
  files?: string[]
}

export interface UpdateNoteInput {
  noteId: string
  title?: string
  summary?: string
  content?: string
  parentId?: string
  files?: string[]
  expectedUpdated?: string
}

export interface NoteWriteResult {
  ok: boolean
  code: string
  message: string | null
  note?: Note
}

export interface UseNoteWriteOptions {
  addNote: (note: Note) => MaybePromise<Note | unknown>
  getNote: (id: string) => MaybePromise<Note | null | undefined>
  updateNote: (id: string, updates: Partial<Note>) => MaybePromise<unknown>
  updateParentFolderSubcount: (note: Note) => MaybePromise<unknown>
  createId?: () => string
  getNow?: () => string
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveItemTitle(itemType: NoteType, title: string | undefined, content: string) {
  const trimmedTitle = title?.trim()
  if (trimmedTitle) {
    return trimmedTitle
  }

  if (itemType === NOTE_TYPE.FOLDER) {
    return '新建文件夹'
  }

  const plainText = stripHtml(content)
  return plainText.slice(0, 50) || '新建备忘录'
}

function resolveItemSummary(
  itemType: NoteType,
  title: string,
  summary: string | undefined,
  content: string,
) {
  if (itemType === NOTE_TYPE.FOLDER) {
    return ''
  }

  if (summary !== undefined) {
    return summary.trim()
  }

  const plainText = stripHtml(content)
  const contentWithoutTitle = plainText.startsWith(title)
    ? plainText.slice(title.length).trim()
    : plainText

  return contentWithoutTitle.slice(0, 255)
}

export function useNoteWrite(options: UseNoteWriteOptions) {
  const createId = options.createId || (() => nanoid(12))
  const getNow = options.getNow || getTime

  async function createNote(input: CreateNoteInput): Promise<NoteWriteResult> {
    const itemType = input.itemType || NOTE_TYPE.NOTE
    const content = itemType === NOTE_TYPE.FOLDER ? '' : (input.content || '')
    const title = resolveItemTitle(itemType, input.title, content)
    const now = getNow()
    const note: Note = {
      id: input.noteId || createId(),
      title,
      summary: resolveItemSummary(itemType, title, input.summary, content),
      created: now,
      content,
      item_type: itemType,
      parent_id: input.parentId || '',
      updated: now,
      version: 1,
      is_deleted: 0,
      is_locked: 0,
      note_count: 0,
      files: input.files || [],
    }

    await options.addNote(note)
    await options.updateParentFolderSubcount(note)

    return {
      ok: true,
      code: 'ok',
      message: null,
      note,
    }
  }

  async function updateNote(input: UpdateNoteInput): Promise<NoteWriteResult> {
    const currentNote = await options.getNote(input.noteId)
    if (!currentNote) {
      return {
        ok: false,
        code: 'note_not_found',
        message: '当前备忘录不存在',
      }
    }

    if (input.expectedUpdated && currentNote.updated !== input.expectedUpdated) {
      return {
        ok: false,
        code: 'version_conflict',
        message: '备忘录已被其他操作更新，请先重新读取',
      }
    }

    const nextContent = input.content ?? currentNote.content
    const nextTitle = resolveItemTitle(currentNote.item_type, input.title ?? currentNote.title, nextContent)
    const nextNote: Note = {
      ...currentNote,
      title: nextTitle,
      summary: resolveItemSummary(
        currentNote.item_type,
        nextTitle,
        input.summary,
        nextContent,
      ),
      content: nextContent,
      parent_id: input.parentId ?? currentNote.parent_id,
      updated: getNow(),
      version: (currentNote.version || 1) + 1,
      files: input.files ?? currentNote.files ?? [],
    }

    await options.updateNote(currentNote.id, nextNote)

    if (currentNote.parent_id !== nextNote.parent_id) {
      await options.updateParentFolderSubcount(currentNote)
    }
    await options.updateParentFolderSubcount(nextNote)

    return {
      ok: true,
      code: 'ok',
      message: null,
      note: nextNote,
    }
  }

  return {
    createNote,
    updateNote,
  }
}
