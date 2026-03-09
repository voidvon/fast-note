/**
 * PocketBase 笔记服务
 */
import { mapErrorMessage, pb } from './client'

type WriteMode = 'auto' | 'create' | 'update'

interface UpdateNoteResult {
  success: boolean
  fileMapping?: Map<File, string>
  record?: any
}

function hasFileToUpload(filesForUpload?: Array<File | string>) {
  return !!filesForUpload?.some(item => item instanceof File)
}

function isNotFoundError(error: any): boolean {
  return error?.status === 404
    || error?.response?.status === 404
    || String(error?.message || '').toLowerCase().includes('not found')
}

function isAlreadyExistsError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase()
  const idCode = String(error?.response?.data?.id?.code || error?.data?.data?.id?.code || '').toLowerCase()

  return idCode === 'validation_pk_invalid'
    || idCode === 'validation_not_unique'
    || message.includes('already exists')
    || message.includes('validation_not_unique')
    || message.includes('validation_pk_invalid')
    || message.includes('primary key is invalid or already exists')
}

function buildWritePayload(noteData: any, filesForUpload?: Array<File | string>) {
  if (!filesForUpload || filesForUpload.length === 0 || !hasFileToUpload(filesForUpload)) {
    if (filesForUpload && filesForUpload.length > 0) {
      return { ...noteData, files: filesForUpload }
    }

    return noteData
  }

  const formData = new FormData()
  Object.keys(noteData).forEach((key) => {
    if (key === 'files')
      return

    const value = noteData[key]
    if (value === null || value === undefined)
      return

    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value))
    }
    else {
      formData.append(key, String(value))
    }
  })

  filesForUpload.forEach((item) => {
    formData.append('files', item)
  })

  return formData
}

function buildFileMapping(filesForUpload: Array<File | string> | undefined, result: any) {
  const fileMapping = new Map<File, string>()

  if (!filesForUpload || !result?.files || !Array.isArray(result.files))
    return fileMapping

  let fileIndex = 0
  for (const item of filesForUpload) {
    if (!(item instanceof File))
      continue

    if (fileIndex < result.files.length) {
      fileMapping.set(item, result.files[fileIndex])
      fileIndex++
    }
  }

  return fileMapping
}

async function createNoteRecord(noteData: any, filesForUpload?: Array<File | string>): Promise<UpdateNoteResult> {
  const payload = buildWritePayload(noteData, filesForUpload)
  const result = await pb.collection('notes').create(payload)
  const fileMapping = buildFileMapping(filesForUpload, result)

  return {
    success: true,
    fileMapping: fileMapping.size > 0 ? fileMapping : undefined,
    record: result || null,
  }
}

async function updateNoteRecord(noteData: any, filesForUpload?: Array<File | string>): Promise<UpdateNoteResult> {
  const payload = buildWritePayload(noteData, filesForUpload)
  const result = await pb.collection('notes').update(noteData.id, payload)
  const fileMapping = buildFileMapping(filesForUpload, result)

  return {
    success: true,
    fileMapping: fileMapping.size > 0 ? fileMapping : undefined,
    record: result || null,
  }
}

export const notesService = {
  /**
   * 获取指定时间之后的所有笔记变更
   */
  async getNotesByUpdated(lastUpdated: string): Promise<{ d: any[] }> {
    try {
      if (!pb.authStore.isValid) {
        throw new Error('用户未登录')
      }

      const records = await pb.collection('notes').getFullList({
        filter: `updated > "${lastUpdated}" && user_id = "${pb.authStore.model?.id}"`,
        sort: '+updated',
      })

      return { d: records || [] }
    }
    catch (error: any) {
      console.error('获取PocketBase笔记失败:', error)
      throw new Error(`获取PocketBase笔记失败: ${mapErrorMessage(error)}`)
    }
  },

  /**
   * 添加新笔记
   */
  async addNote(note: any): Promise<string> {
    try {
      const record = await pb.collection('notes').create({
        ...note,
        user_id: pb.authStore.model?.id,
      })

      return record.id
    }
    catch (error: any) {
      console.error('添加PocketBase笔记失败:', error)
      throw new Error(`添加PocketBase笔记失败: ${mapErrorMessage(error)}`)
    }
  },

  /**
   * 更新笔记（upsert 操作）
   */
  async updateNote(
    note: any,
    filesForUpload?: Array<File | string>,
    mode: WriteMode = 'auto',
  ): Promise<UpdateNoteResult> {
    try {
      const noteData = {
        ...note,
        user_id: pb.authStore.model?.id,
      }

      if (mode === 'create') {
        try {
          return await createNoteRecord(noteData, filesForUpload)
        }
        catch (error: any) {
          if (!isAlreadyExistsError(error))
            throw error

          return await updateNoteRecord(noteData, filesForUpload)
        }
      }

      if (mode === 'update') {
        try {
          return await updateNoteRecord(noteData, filesForUpload)
        }
        catch (error: any) {
          if (!isNotFoundError(error))
            throw error

          return await createNoteRecord(noteData, filesForUpload)
        }
      }

      try {
        return await updateNoteRecord(noteData, filesForUpload)
      }
      catch (error: any) {
        if (!isNotFoundError(error))
          throw error

        return await createNoteRecord(noteData, filesForUpload)
      }
    }
    catch (error: any) {
      console.error('更新PocketBase笔记失败:', error)
      throw new Error(`更新PocketBase笔记失败: ${mapErrorMessage(error)}`)
    }
  },

  /**
   * 获取公开笔记
   */
  async getPublicNotes(user_id: string): Promise<any[]> {
    const record = await pb.collection('notes').getFullList({
      filter: `is_public = true && user_id = "${user_id}"`,
    })
    return record
  },
}
