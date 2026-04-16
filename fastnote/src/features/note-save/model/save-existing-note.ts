import type { Note } from '@/shared/types'
import type { NoteWriteResult, UpdateNoteInput } from '@/features/note-write'

type MaybePromise<T> = T | Promise<T>

export interface SaveExistingNoteInput {
  content: string
  files?: string[]
  noteId: string
  summary?: string
  title?: string
}

export interface SaveExistingNoteOptions {
  setCurrentNote?: (note: Note | null) => MaybePromise<void>
  sync?: (silent?: boolean) => MaybePromise<unknown>
  writeNote: (input: UpdateNoteInput) => MaybePromise<NoteWriteResult>
}

export interface SaveExistingNoteResult {
  code: string
  message: string | null
  note?: Note
  ok: boolean
  syncQueued: boolean
}

export async function saveExistingNote(options: SaveExistingNoteOptions, input: SaveExistingNoteInput): Promise<SaveExistingNoteResult> {
  const updateResult = await options.writeNote({
    noteId: input.noteId,
    title: input.title,
    summary: input.summary,
    content: input.content,
    files: input.files ?? [],
  })

  if (!updateResult.ok || !updateResult.note) {
    return {
      ok: false,
      code: updateResult.code,
      message: updateResult.message,
      syncQueued: false,
    }
  }

  await options.setCurrentNote?.(updateResult.note)

  let syncQueued = false

  if (options.sync) {
    try {
      await options.sync(true)
      syncQueued = true
    }
    catch {
      syncQueued = false
    }
  }

  return {
    ok: true,
    code: updateResult.code,
    message: updateResult.message,
    note: updateResult.note,
    syncQueued,
  }
}
