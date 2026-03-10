/**
 * PocketBase 用户服务
 */
import { mapErrorMessage, pb } from './client'

function toPinSettings(record: any) {
  if (!record) {
    return null
  }

  return {
    note_lock_pin_salt: record.note_lock_pin_salt ?? null,
    note_lock_pin_hash: record.note_lock_pin_hash ?? null,
    note_lock_pin_version: record.note_lock_pin_version ?? null,
    updated: record.updated ?? null,
  }
}

export const usersService = {
  /**
   * 根据用户名获取用户信息
   */
  async getUserByUsername(username: string): Promise<any | null> {
    try {
      // 从 public_users 视图查询用户名匹配的用户
      const record = await pb.collection('public_users').getFirstListItem(`username = "${username}"`)
      return record
    }
    catch (error: any) {
      // 如果是找不到记录的错误，返回 null
      if (error?.status === 404) {
        return null
      }
      console.error('根据用户名获取用户失败:', error)
      throw new Error(`根据用户名获取用户失败: ${mapErrorMessage(error)}`)
    }
  },

  /**
   * 根据用户ID获取用户信息
   */
  async getUserById(id: string): Promise<any | null> {
    try {
      const record = await pb.collection('users').getOne(id)
      return record
    }
    catch (error: any) {
      console.error('根据ID获取用户失败:', error)
      return null
    }
  },

  async getCurrentUserPinSettings(options: {
    force?: boolean
  } = {}) {
    try {
      if (!pb.authStore.isValid || !pb.authStore.model?.id) {
        return null
      }

      if (!options.force) {
        return toPinSettings(pb.authStore.model)
      }

      const record = await pb.collection('users').getOne(pb.authStore.model.id)
      pb.authStore.save(pb.authStore.token, record)
      return toPinSettings(record)
    }
    catch (error: any) {
      console.error('获取当前用户 PIN 设置失败:', error)
      throw new Error(`获取当前用户 PIN 设置失败: ${mapErrorMessage(error)}`)
    }
  },

  async updateCurrentUserPinSettings(payload: {
    note_lock_pin_salt: string | null
    note_lock_pin_hash: string | null
    note_lock_pin_version: number | null
  }) {
    try {
      if (!pb.authStore.isValid || !pb.authStore.model?.id) {
        throw new Error('用户未登录')
      }

      const record = await pb.collection('users').update(pb.authStore.model.id, payload)
      pb.authStore.save(pb.authStore.token, record)
      return toPinSettings(record)
    }
    catch (error: any) {
      console.error('更新当前用户 PIN 设置失败:', error)
      throw new Error(`更新当前用户 PIN 设置失败: ${mapErrorMessage(error)}`)
    }
  },
}
