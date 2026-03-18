import type { AuthChangeCallback, AuthResult, IAuthService } from '@/core/auth-types'
import type { UserInfo } from '@/shared/types'
import { pb } from './client'

function toUserInfo(model: any): UserInfo {
  return {
    id: model.id,
    email: model.email,
    username: model.username,
    avatar: model.avatar || '',
    created: model.created || new Date().toISOString().replace('T', ' '),
    updated: model.updated || new Date().toISOString().replace('T', ' '),
  }
}

export class PocketBaseAuthService implements IAuthService {
  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const authData = await pb.collection('users').authWithPassword(email, password)

      if (authData.record) {
        return {
          success: true,
          user: toUserInfo(authData.record),
        }
      }

      return {
        success: false,
        error: '登录失败：未返回用户信息',
      }
    }
    catch (error: any) {
      console.error('PocketBase 登录失败:', error)
      return {
        success: false,
        error: error.message || '登录失败',
      }
    }
  }

  async signUp(
    email: string,
    password: string,
    passwordConfirm: string,
    username?: string,
  ): Promise<AuthResult> {
    try {
      await pb.collection('users').create({
        email,
        password,
        passwordConfirm,
        username: username || email.split('@')[0],
      })

      const authData = await pb.collection('users').authWithPassword(email, password)

      if (authData.record) {
        return {
          success: true,
          user: toUserInfo(authData.record),
        }
      }

      return {
        success: false,
        error: '注册成功但登录失败',
      }
    }
    catch (error: any) {
      console.error('PocketBase 注册失败:', error)
      return {
        success: false,
        error: error.message || '注册失败',
      }
    }
  }

  async signOut(): Promise<void> {
    pb.authStore.clear()
  }

  async getCurrentUser(): Promise<AuthResult> {
    try {
      if (!pb.authStore.isValid || !pb.authStore.model) {
        return {
          success: false,
          error: '未登录',
        }
      }

      const authData = await pb.collection('users').authRefresh()

      if (authData.record) {
        return {
          success: true,
          user: toUserInfo(authData.record),
        }
      }

      return {
        success: false,
        error: '获取用户信息失败',
      }
    }
    catch (error: any) {
      console.error('PocketBase 获取用户信息失败:', error)
      return {
        success: false,
        error: error.message || '获取用户信息失败',
      }
    }
  }

  getCurrentAuthUser(): UserInfo | null {
    if (!pb.authStore.isValid || !pb.authStore.model) {
      return null
    }

    return toUserInfo(pb.authStore.model)
  }

  isAuthenticated(): boolean {
    return pb.authStore.isValid
  }

  getToken(): string | null {
    return pb.authStore.token || null
  }

  onAuthChange(callback: AuthChangeCallback): () => void {
    return pb.authStore.onChange((token, model) => {
      callback(token, model ? toUserInfo(model) : null)
    })
  }
}

export const pocketbaseAuthService = new PocketBaseAuthService()
