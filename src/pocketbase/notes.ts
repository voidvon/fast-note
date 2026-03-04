/**
 * PocketBase 笔记服务
 */
import { mapErrorMessage, pb } from './client'

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
  async updateNote(note: any, filesForUpload?: Array<File | string>): Promise<{
    success: boolean
    fileMapping?: Map<File, string> // File对象到PocketBase文件名的映射
    record?: any // 返回的完整记录信息
  }> {
    try {
      // 先尝试查找是否存在
      const existingRecords = await pb.collection('notes').getFullList({
        filter: `id = "${note.id}" && user_id = "${pb.authStore.model?.id}"`,
      })

      const noteData = {
        ...note,
        user_id: pb.authStore.model?.id,
      }

      // 创建文件映射
      const fileMapping = new Map<File, string>()
      let result: any = null

      // 如果有文件需要处理，使用FormData
      if (filesForUpload && filesForUpload.length > 0) {
        // 检查是否有File对象需要上传
        const hasFilesToUpload = filesForUpload.some(item => item instanceof File)

        if (hasFilesToUpload) {
          const formData = new FormData()

          // 添加笔记的基本数据（除了files字段）
          Object.keys(noteData).forEach((key) => {
            if (key !== 'files') { // files字段单独处理
              const value = noteData[key]
              if (value !== null && value !== undefined) {
                if (Array.isArray(value)) {
                  formData.append(key, JSON.stringify(value))
                }
                else {
                  formData.append(key, String(value))
                }
              }
            }
          })

          // 直接将filesForUpload数组作为files字段
          // PocketBase会自动处理File对象（上传）和字符串（保留）
          filesForUpload.forEach((item) => {
            formData.append('files', item)
          })

          if (existingRecords.length > 0) {
            // 更新现有记录
            result = await pb.collection('notes').update(existingRecords[0].id, formData)
          }
          else {
            // 创建新记录
            result = await pb.collection('notes').create(formData)
          }

          // 处理文件映射：从PocketBase返回的result中提取文件名
          if (result && result.files && Array.isArray(result.files)) {
            let fileIndex = 0
            for (let i = 0; i < filesForUpload.length; i++) {
              const item = filesForUpload[i]
              if (item instanceof File) {
                // 对于File对象，映射到PocketBase返回的文件名
                if (fileIndex < result.files.length) {
                  fileMapping.set(item, result.files[fileIndex])
                  console.warn(`文件映射: ${item.name} -> ${result.files[fileIndex]}`)
                  fileIndex++
                }
              }
            }
          }
        }
        else {
          // 没有File对象，只有字符串文件名，使用普通JSON
          const updatedNoteData = { ...noteData, files: filesForUpload }
          if (existingRecords.length > 0) {
            result = await pb.collection('notes').update(existingRecords[0].id, updatedNoteData)
          }
          else {
            result = await pb.collection('notes').create(updatedNoteData)
          }
        }
      }
      else {
        // 没有文件，使用普通的JSON数据
        if (existingRecords.length > 0) {
          // 更新现有记录
          result = await pb.collection('notes').update(existingRecords[0].id, noteData)
        }
        else {
          // 创建新记录
          result = await pb.collection('notes').create(noteData)
        }
      }

      return {
        success: true,
        fileMapping: fileMapping.size > 0 ? fileMapping : undefined,
        record: result || null,
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
