import type { NoteFile } from '@/shared/lib/storage'
import type { Note } from '@/shared/types'
import { commitUploadedNoteAttachments, extractAttachmentReferences } from '@/entities/attachment'
import { getTime } from '@/shared/lib/date'
import {
  buildNoteFileUrl,
  replaceAttachmentUrls,
} from '@/shared/lib/editor/extensions/FileUpload/attachment-html'
import { hasRemoteUserId } from './domain/note-rules'
import { noteRemoteService } from './note-remote-service'
import { useNote } from './state/note-store'
import { useNoteFiles } from './use-note-files'

export interface NoteRemoteSyncResult {
  syncedUpdatedAt: string
}

function getRecoveryUpdatedAt(remoteUpdated?: string) {
  const remoteTime = remoteUpdated
    ? new Date(remoteUpdated.replace(' ', 'T')).getTime()
    : 0
  const minimumTime = Number.isFinite(remoteTime) ? remoteTime + 1 : 0
  return getTime(new Date(Math.max(Date.now(), minimumTime)).toISOString())
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
    desiredRemoteFilenames: string[]
    filesForStaging: Array<File | string>
    localFiles: NoteFile[]
  }> {
    const references = extractAttachmentReferences(note.content)
    const localFiles: NoteFile[] = []

    for (const hash of references.hashes) {
      const localFile = await getNoteFileByHash(hash)
      if (!localFile?.file)
        throw new Error(`本地附件不存在，停止同步: ${hash}`)
      localFiles.push(localFile)
    }

    const preservedRemoteFilenames = [...new Set([
      ...(note.files || []),
      ...references.remoteFilenames,
    ])]

    return {
      desiredRemoteFilenames: references.remoteFilenames,
      filesForStaging: [...preservedRemoteFilenames, ...localFiles.map(file => file.file)],
      localFiles,
    }
  }

  async function syncNoteToRemote(note: Note, mode: 'create' | 'update'): Promise<NoteRemoteSyncResult> {
    const { desiredRemoteFilenames, filesForStaging, localFiles } = await prepareNoteFilesForRemoteSync(note)

    if (localFiles.length === 0) {
      const result = await noteRemoteService.updateNote(note, desiredRemoteFilenames, mode)
      return {
        syncedUpdatedAt: await backfillRemoteNoteMetadata(note.id, result.record) || note.updated,
      }
    }

    const staged = await noteRemoteService.stageNoteFiles(note, filesForStaging, mode)
    if (!staged.success || !staged.fileMapping)
      throw new Error('附件预上传未返回文件映射')

    const replacements = new Map<string, string>()
    const uploadedMappings = localFiles.map((file) => {
      const remoteFilename = staged.fileMapping!.get(file.file)
      if (!remoteFilename)
        throw new Error(`附件预上传未返回文件名: ${file.fileName}`)
      replacements.set(file.hash, buildNoteFileUrl(note.id, remoteFilename))
      return { file, remoteFilename }
    })
    const uploadedRemoteFilenames = uploadedMappings.map(mapping => mapping.remoteFilename)
    const finalFiles = [...new Set([...desiredRemoteFilenames, ...uploadedRemoteFilenames])]
    const finalNote: Note = {
      ...note,
      content: replaceAttachmentUrls(note.content || '', replacements),
      files: finalFiles,
      updated: getRecoveryUpdatedAt(staged.record?.updated),
      user_id: typeof staged.record?.user_id === 'string' && staged.record.user_id
        ? staged.record.user_id
        : note.user_id,
    }

    await commitUploadedNoteAttachments(finalNote, uploadedMappings)
    updateNote(note.id, finalNote)

    const finalResult = await noteRemoteService.updateNote(finalNote, finalFiles, 'update')

    return {
      syncedUpdatedAt: await backfillRemoteNoteMetadata(note.id, finalResult.record) || finalNote.updated,
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
