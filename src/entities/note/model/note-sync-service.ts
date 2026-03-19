import type { Note } from '@/shared/types'
import { getTime } from '@/shared/lib/date'
import { hasRemoteUserId } from './domain/note-rules'
import { noteRemoteService } from './note-remote-service'
import { useNoteFiles } from './use-note-files'
import { useNote } from './state/note-store'

export interface NoteRemoteSyncResult {
  syncedUpdatedAt: string
}

function extractFileReferencesFromContent(content: string): string[] {
  const fileRefRegex = /<file-upload[^>]+url="([^"]+)"/g
  const fileReferences: string[] = []
  let match = fileRefRegex.exec(content)

  while (match !== null) {
    fileReferences.push(match[1])
    match = fileRefRegex.exec(content)
  }

  return fileReferences
}

function isHashValue(str: string): boolean {
  return /^[a-f0-9]{64}$/i.test(str)
}

function generateTempFileId(index: number): string {
  return `__TEMP_FILE_${index}__`
}

export function useNoteSyncService() {
  const { getNoteFileByHash } = useNoteFiles()
  const { updateNote } = useNote()

  async function backfillRemoteNoteMetadata(noteId: string, record: Partial<Note> | null | undefined) {
    if (!record) {
      return null
    }

    const updates: Partial<Note> = {}

    if (typeof record.user_id === 'string' && record.user_id.trim()) {
      updates.user_id = record.user_id
    }

    if (typeof record.updated === 'string' && record.updated) {
      updates.updated = record.updated
    }

    if (Array.isArray(record.files)) {
      updates.files = record.files
    }

    if (Object.keys(updates).length === 0) {
      return null
    }

    await updateNote(noteId, updates)
    return updates.updated || null
  }

  async function prepareNoteFilesForRemoteSync(note: Note): Promise<{
    updatedNote: Note
    filesForUpload: Array<File | string> | undefined
  }> {
    const fileReferences = note.content ? extractFileReferencesFromContent(note.content) : []

    if (fileReferences.length === 0) {
      return {
        updatedNote: note,
        filesForUpload: undefined,
      }
    }

    let updatedContent = note.content || ''
    const filesForUpload: Array<File | string> = []
    const hashToTempIdMapping = new Map<string, string>()
    const processedFiles = new Set<string>()
    let tempFileIndex = 0

    for (const hashOrFilename of fileReferences) {
      try {
        if (isHashValue(hashOrFilename)) {
          const localFile = await getNoteFileByHash(hashOrFilename)

          if (localFile?.file) {
            let tempId: string

            if (hashToTempIdMapping.has(hashOrFilename)) {
              tempId = hashToTempIdMapping.get(hashOrFilename)!
            }
            else {
              tempId = generateTempFileId(tempFileIndex)
              tempFileIndex++
              hashToTempIdMapping.set(hashOrFilename, tempId)
              filesForUpload.push(localFile.file)
            }

            const hashRegex = new RegExp(
              `(<file-upload[^>]+url=")${hashOrFilename}("[^>]*>)`,
              'g',
            )
            updatedContent = updatedContent.replace(hashRegex, `$1${tempId}$2`)
          }
        }
        else if (!processedFiles.has(hashOrFilename)) {
          filesForUpload.push(hashOrFilename)
          processedFiles.add(hashOrFilename)
        }
      }
      catch (error) {
        console.error(`处理文件失败: ${hashOrFilename}`, error)
        if (!isHashValue(hashOrFilename) && !processedFiles.has(hashOrFilename)) {
          filesForUpload.push(hashOrFilename)
          processedFiles.add(hashOrFilename)
        }
      }
    }

    return {
      updatedNote: { ...note, content: updatedContent },
      filesForUpload: filesForUpload.length > 0 ? filesForUpload : [],
    }
  }

  function applyUploadedFilesToContent(
    content: string,
    filesForUpload: Array<File | string>,
    pocketbaseFiles: string[],
  ): string {
    let updatedContent = content
    let fileObjectIndex = 0

    for (let i = 0; i < filesForUpload.length; i++) {
      const item = filesForUpload[i]

      if (!(item instanceof File)) {
        continue
      }

      const tempId = generateTempFileId(fileObjectIndex)

      if (i < pocketbaseFiles.length) {
        const pocketbaseFilename = pocketbaseFiles[i]
        const tempIdRegex = new RegExp(
          `(<file-upload[^>]+url=")${tempId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}("[^>]*>)`,
          'g',
        )
        updatedContent = updatedContent.replace(tempIdRegex, `$1${pocketbaseFilename}$2`)
      }

      fileObjectIndex++
    }

    return updatedContent
  }

  async function syncNoteToRemote(note: Note, mode: 'create' | 'update'): Promise<NoteRemoteSyncResult> {
    const { updatedNote, filesForUpload } = await prepareNoteFilesForRemoteSync(note)
    const result = filesForUpload !== undefined
      ? await noteRemoteService.updateNote(updatedNote, filesForUpload, mode)
      : await noteRemoteService.updateNote(updatedNote, undefined, mode)

    let syncedUpdatedAt = await backfillRemoteNoteMetadata(note.id, result.record) || note.updated

    if (filesForUpload && filesForUpload.length > 0 && result.success && result.record?.files && Array.isArray(result.record.files)) {
      const finalContent = applyUploadedFilesToContent(
        updatedNote.content || '',
        filesForUpload,
        result.record.files,
      )

      if (finalContent !== updatedNote.content) {
        const finalNote = {
          ...updatedNote,
          content: finalContent,
          files: result.record.files,
          updated: getTime(),
        }

        await updateNote(note.id, finalNote)
        const finalResult = await noteRemoteService.updateNote(finalNote, undefined, 'update')
        syncedUpdatedAt = await backfillRemoteNoteMetadata(note.id, finalResult.record) || finalNote.updated
      }
    }

    return {
      syncedUpdatedAt,
    }
  }

  async function syncDeletedNoteToRemote(note: Note): Promise<NoteRemoteSyncResult> {
    const result = await noteRemoteService.updateNote(note, undefined, 'update')

    return {
      syncedUpdatedAt: await backfillRemoteNoteMetadata(note.id, result.record) || note.updated,
    }
  }

  return {
    hasRemoteUserId,
    syncDeletedNoteToRemote,
    syncNoteToRemote,
  }
}
