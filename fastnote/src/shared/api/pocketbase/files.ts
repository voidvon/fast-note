import { mapErrorMessage, pb } from './client'

export const filesService = {
  async getSignedFileUrl(noteUuid: string, hash: string): Promise<{ signedUrl: string, type: string } | null> {
    try {
      if (!pb.authStore.isValid) {
        throw new Error('用户未登录')
      }

      const notes = await pb.collection('notes').getFullList({
        filter: `id = "${noteUuid}" && user_id = "${pb.authStore.model?.id}"`,
      })

      if (notes.length === 0) {
        throw new Error('笔记不存在或无权限访问')
      }

      const files = await pb.collection('files').getFullList({
        filter: `hash = "${hash}"`,
        limit: 1,
      })

      if (files.length === 0) {
        throw new Error('文件不存在')
      }

      const file = files[0]
      const signedUrl = pb.files.getUrl(file, file.path)

      return {
        signedUrl,
        type: file.type || '',
      }
    }
    catch (error: any) {
      console.error('获取文件签名URL失败:', error)
      throw new Error(`获取文件签名URL失败: ${mapErrorMessage(error)}`)
    }
  },

  async uploadFile(file: File, userId: string): Promise<{ id: string, hash: string, path: string }> {
    try {
      if (!pb.authStore.isValid) {
        throw new Error('用户未登录')
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('user_id', userId)
      formData.append('type', file.type)
      formData.append('name', file.name)
      formData.append('size', file.size.toString())

      const record = await pb.collection('files').create(formData)

      return {
        id: record.id,
        hash: record.hash,
        path: pb.files.getUrl(record, record.file),
      }
    }
    catch (error: any) {
      console.error('上传文件失败:', error)
      throw new Error(`上传文件失败: ${mapErrorMessage(error)}`)
    }
  },

  async getFileByHash(hash: string): Promise<{ url: string, type: string } | null> {
    try {
      const files = await pb.collection('files').getFullList({
        filter: `hash = "${hash}"`,
        limit: 1,
      })

      if (files.length === 0) {
        return null
      }

      const file = files[0]
      return {
        url: pb.files.getUrl(file, file.file),
        type: file.type || '',
      }
    }
    catch (error: any) {
      console.error('根据hash获取文件失败:', error)
      return null
    }
  },

  getFileByFilename(noteId: string, filename: string): Promise<{ url: string, type: string } | null> {
    try {
      const fakeRecord = { id: noteId, collectionId: 'notes', collectionName: 'notes' }
      const fileUrl = pb.files.getUrl(fakeRecord, filename)

      return Promise.resolve({
        url: fileUrl,
        type: '',
      })
    }
    catch (error: any) {
      console.error('根据文件名获取文件失败:', error)
      return Promise.resolve(null)
    }
  },
}

export { filesService as filesApi }
