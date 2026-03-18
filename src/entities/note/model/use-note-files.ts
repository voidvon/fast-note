import type { NoteFile } from '@/shared/lib/storage'
import { useDexie } from '@/shared/lib/storage'
import { getTime } from '@/utils/date'

export function useNoteFiles() {
  const { db } = useDexie()

  async function addNoteFile(file: File, hash: string): Promise<void> {
    const noteFile: NoteFile = {
      hash,
      file,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      created: getTime(),
      updated: getTime(),
    }

    await db.value?.note_files.put(noteFile)
  }

  async function getNoteFileByHash(hash: string): Promise<NoteFile | undefined> {
    return await db.value?.note_files.get(hash)
  }

  async function getNoteFilesByHashes(hashes: string[]): Promise<NoteFile[]> {
    if (!db.value || hashes.length === 0) {
      return []
    }

    const files = await Promise.all(
      hashes.map(hash => db.value!.note_files.get(hash)),
    )

    return files.filter(Boolean) as NoteFile[]
  }

  async function noteFileExists(hash: string): Promise<boolean> {
    const file = await db.value?.note_files.get(hash)
    return !!file
  }

  async function deleteNoteFile(hash: string): Promise<void> {
    await db.value?.note_files.delete(hash)
  }

  async function deleteNoteFiles(hashes: string[]): Promise<void> {
    if (!db.value || hashes.length === 0) {
      return
    }

    await Promise.all(
      hashes.map(hash => db.value!.note_files.delete(hash)),
    )
  }

  async function getAllNoteFiles(): Promise<NoteFile[]> {
    return await db.value?.note_files.toArray() || []
  }

  async function cleanupUnreferencedFiles(referencedHashes: string[]): Promise<void> {
    if (!db.value)
      return

    const allFiles = await db.value.note_files.toArray()
    const referencedHashSet = new Set(referencedHashes)

    const unreferencedFiles = allFiles.filter(file => !referencedHashSet.has(file.hash))

    if (unreferencedFiles.length > 0) {
      await Promise.all(
        unreferencedFiles.map(file => db.value!.note_files.delete(file.hash)),
      )
    }
  }

  async function updateNoteFile(hash: string, updates: Partial<Omit<NoteFile, 'hash'>>): Promise<void> {
    const existingFile = await db.value?.note_files.get(hash)
    if (!existingFile) {
      throw new Error(`文件 ${hash} 不存在`)
    }

    const updatedFile: NoteFile = {
      ...existingFile,
      ...updates,
      updated: getTime(),
    }

    await db.value?.note_files.put(updatedFile)
  }

  return {
    addNoteFile,
    getNoteFileByHash,
    getNoteFilesByHashes,
    noteFileExists,
    deleteNoteFile,
    deleteNoteFiles,
    getAllNoteFiles,
    cleanupUnreferencedFiles,
    updateNoteFile,
  }
}
