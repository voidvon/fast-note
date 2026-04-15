import type { PublicUserInfo } from '@/shared/types/pocketbase'
import { authUsersService } from '@/entities/auth'

const userCache = new Map<string, PublicUserInfo>()

export function usePublicUserCache() {
  async function getPublicUserInfo(username: string): Promise<PublicUserInfo | null> {
    const cachedUser = userCache.get(username)
    if (cachedUser) {
      return cachedUser
    }

    try {
      const user = await authUsersService.getPublicUserInfo(username)
      if (user) {
        userCache.set(username, user)
        return user
      }
    }
    catch (error) {
      console.error('获取用户信息失败:', error)
    }

    return null
  }

  return {
    getPublicUserInfo,
  }
}

export const publicUserCache = usePublicUserCache()
