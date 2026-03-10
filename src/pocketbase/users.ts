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

function isPinSettingsMatched(
  actual: ReturnType<typeof toPinSettings>,
  expected: {
    note_lock_pin_salt: string | null
    note_lock_pin_hash: string | null
    note_lock_pin_version: number | null
  },
) {
  return actual?.note_lock_pin_salt === expected.note_lock_pin_salt
    && actual?.note_lock_pin_hash === expected.note_lock_pin_hash
    && actual?.note_lock_pin_version === expected.note_lock_pin_version
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

      const userId = pb.authStore.model.id
      const record = await pb.collection('users').update(userId, payload)
      const recordPinSettings = toPinSettings(record)

      if (isPinSettingsMatched(recordPinSettings, payload)) {
        pb.authStore.save(pb.authStore.token, record)
        return recordPinSettings
      }

      const latestRecord = await pb.collection('users').getOne(userId)
      const latestPinSettings = toPinSettings(latestRecord)
      pb.authStore.save(pb.authStore.token, latestRecord)

      if (isPinSettingsMatched(latestPinSettings, payload)) {
        return latestPinSettings
      }

      throw new Error('PocketBase users 表未保存备忘录锁字段，请确认已创建并开放 note_lock_pin_salt/hash/version')
    }
    catch (error: any) {
      console.error('更新当前用户 PIN 设置失败:', error)
      throw new Error(`更新当前用户 PIN 设置失败: ${mapErrorMessage(error)}`)
    }
  },
}
