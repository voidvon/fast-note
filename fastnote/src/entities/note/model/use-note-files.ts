import type { NoteFile } from '@/shared/lib/storage'
import { getTime } from '@/shared/lib/date'
import {
  deleteStoredNoteFile,
  deleteStoredNoteFiles,
  getStoredNoteFile,
  getStoredNoteFiles,
  hasStoredNoteFile,
  listStoredNoteFiles,
  putStoredNoteFile,
  useDexie,
} from '@/shared/lib/storage'

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

    if (!db.value) {
      return
    }

    await putStoredNoteFile(db.value, noteFile)
  }

  async function getNoteFileByHash(hash: string): Promise<NoteFile | undefined> {
    if (!db.value) {
      return undefined
    }

    return await getStoredNoteFile(db.value, hash)
  }

  async function getNoteFilesByHashes(hashes: string[]): Promise<NoteFile[]> {
    if (!db.value || hashes.length === 0) {
      return []
    }

    return await getStoredNoteFiles(db.value, hashes)
  }

  async function noteFileExists(hash: string): Promise<boolean> {
    if (!db.value) {
      return false
    }

    return await hasStoredNoteFile(db.value, hash)
  }

  async function deleteNoteFile(hash: string): Promise<void> {
    if (!db.value) {
      return
    }

    await deleteStoredNoteFile(db.value, hash)
  }

  async function deleteNoteFiles(hashes: string[]): Promise<void> {
    if (!db.value || hashes.length === 0) {
      return
    }

    await deleteStoredNoteFiles(db.value, hashes)
  }

  async function getAllNoteFiles(): Promise<NoteFile[]> {
    if (!db.value) {
      return []
    }

    return await listStoredNoteFiles(db.value)
  }

  async function cleanupUnreferencedFiles(referencedHashes: string[]): Promise<void> {
    if (!db.value)
      return

    const allFiles = await listStoredNoteFiles(db.value)
    const referencedHashSet = new Set(referencedHashes)

    const unreferencedFiles = allFiles.filter(file => !referencedHashSet.has(file.hash))

    if (unreferencedFiles.length > 0) {
      await deleteStoredNoteFiles(db.value, unreferencedFiles.map(file => file.hash))
    }
  }

  async function updateNoteFile(hash: string, updates: Partial<Omit<NoteFile, 'hash'>>): Promise<void> {
    if (!db.value) {
      throw new Error('数据库未初始化')
    }

    const existingFile = await getStoredNoteFile(db.value, hash)
    if (!existingFile) {
      throw new Error(`文件 ${hash} 不存在`)
    }

    const updatedFile: NoteFile = {
      ...existingFile,
      ...updates,
      updated: getTime(),
    }

    await putStoredNoteFile(db.value, updatedFile)
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
