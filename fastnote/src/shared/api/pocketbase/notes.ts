import { mapErrorMessage, pb } from './client'

const PUBLIC_NOTE_LIST_FIELDS = [
  'id',
  'user_id',
  'title',
  'summary',
  'parent_id',
  'item_type',
  'note_count',
  'is_deleted',
  'is_public',
  'is_locked',
  'created',
  'updated',
].join(',')

export const PUBLIC_NOTES_PAGE_SIZE = 30

export interface PublicNotesPage {
  items: any[]
  page: number
  perPage: number
  totalItems: number
  totalPages: number
}

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
  if (!filesForUpload || !hasFileToUpload(filesForUpload)) {
    if (filesForUpload !== undefined) {
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

  for (let index = 0; index < filesForUpload.length; index++) {
    const item = filesForUpload[index]
    if (!(item instanceof File))
      continue

    if (index < result.files.length)
      fileMapping.set(item, result.files[index])
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
  async getNoteManifest(): Promise<Array<{ id: string, updated: string }>> {
    if (!pb.authStore.isValid) {
      throw new Error('用户未登录')
    }

    const records = await pb.collection('notes').getFullList({
      fields: 'id,updated',
      filter: `user_id = "${pb.authStore.model?.id}"`,
      sort: '+id',
    })
    return records.map(record => ({ id: record.id, updated: record.updated }))
  },

  async deleteNote(noteId: string): Promise<void> {
    try {
      await pb.collection('notes').delete(noteId)
    }
    catch (error: any) {
      if (!isNotFoundError(error))
        throw new Error(`删除PocketBase笔记失败: ${mapErrorMessage(error)}`)
    }
  },

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

  async getPublicFolders(userId: string): Promise<any[]> {
    return await pb.collection('notes').getFullList({
      fields: PUBLIC_NOTE_LIST_FIELDS,
      filter: pb.filter(
        'is_public = true && is_deleted = 0 && item_type = 1 && user_id = {:userId}',
        { userId },
      ),
      requestKey: `public-folders:${userId}`,
      sort: '+created',
    })
  },

  async getPublicNotesPage(
    userId: string,
    parentId: string,
    page = 1,
    perPage = PUBLIC_NOTES_PAGE_SIZE,
  ): Promise<PublicNotesPage> {
    const parentFilter = parentId === 'allnotes'
      ? ''
      : parentId === 'unfilednotes'
        ? ' && parent_id = ""'
        : ' && parent_id = {:parentId}'

    return await pb.collection('notes').getList(page, perPage, {
      fields: PUBLIC_NOTE_LIST_FIELDS,
      filter: pb.filter(
        `is_public = true && is_deleted = 0 && item_type = 2 && user_id = {:userId}${parentFilter}`,
        { parentId, userId },
      ),
      requestKey: `public-notes:${userId}:${parentId}:${page}:${perPage}`,
      sort: '-updated',
    })
  },

  async getPublicNote(userId: string, noteId: string): Promise<any> {
    return await pb.collection('notes').getFirstListItem(
      pb.filter(
        'id = {:noteId} && is_public = true && is_deleted = 0 && item_type = 2 && user_id = {:userId}',
        { noteId, userId },
      ),
      {
        requestKey: `public-note:${userId}:${noteId}`,
      },
    )
  },
}

export { notesService as notesApi }
