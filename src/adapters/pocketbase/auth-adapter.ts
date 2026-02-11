/**
 * PocketBase 认证服务适配器
 * 实现 IAuthService 接口
 */

import type { AuthChangeCallback, AuthResult, IAuthService } from '@/core/auth-types'
import type { UserInfo } from '@/types'
import { pb } from '@/pocketbase'

export class PocketBaseAuthAdapter implements IAuthService {
  /**
   * 登录
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const authData = await pb.collection('users').authWithPassword(email, password)

      if (authData.record) {
        const user: UserInfo = {
          id: authData.record.id,
          email: authData.record.email,
          username: authData.record.username,
          avatar: authData.record.avatar || '',
          created: authData.record.created || new Date().toISOString().replace('T', ' '),
          updated: authData.record.updated || new Date().toISOString().replace('T', ' '),
        }

        return {
          success: true,
          user,
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

  /**
   * 注册
   */
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

      // 注册成功后自动登录
      const authData = await pb.collection('users').authWithPassword(email, password)

      if (authData.record) {
        const user: UserInfo = {
          id: authData.record.id,
          email: authData.record.email,
          username: authData.record.username,
          avatar: authData.record.avatar || '',
          created: authData.record.created || new Date().toISOString().replace('T', ' '),
          updated: authData.record.updated || new Date().toISOString().replace('T', ' '),
        }

        return {
          success: true,
          user,
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

  /**
   * 登出
   */
  async signOut(): Promise<void> {
    pb.authStore.clear()
  }

  /**
   * 获取当前用户
   */
  async getCurrentUser(): Promise<AuthResult> {
    try {
      if (!pb.authStore.isValid || !pb.authStore.model) {
        return {
          success: false,
          error: '未登录',
        }
      }

      // 刷新认证状态
      const authData = await pb.collection('users').authRefresh()

      if (authData.record) {
        const user: UserInfo = {
          id: authData.record.id,
          email: authData.record.email,
          username: authData.record.username,
          avatar: authData.record.avatar || '',
          created: authData.record.created || new Date().toISOString().replace('T', ' '),
          updated: authData.record.updated || new Date().toISOString().replace('T', ' '),
        }

        return {
          success: true,
          user,
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

  /**
   * 获取本地认证用户（不发起网络请求）
   */
  getCurrentAuthUser(): UserInfo | null {
    if (!pb.authStore.isValid || !pb.authStore.model) {
      return null
    }

    const model = pb.authStore.model
    return {
      id: model.id,
      email: model.email,
      username: model.username,
      avatar: model.avatar || '',
      created: model.created || new Date().toISOString().replace('T', ' '),
      updated: model.updated || new Date().toISOString().replace('T', ' '),
    }
  }

  /**
   * 检查是否已认证
   */
  isAuthenticated(): boolean {
    return pb.authStore.isValid
  }

  /**
   * 获取认证令牌
   */
  getToken(): string | null {
    return pb.authStore.token || null
  }

  /**
   * 监听认证状态变化
   */
  onAuthChange(callback: AuthChangeCallback): () => void {
    return pb.authStore.onChange((token, model) => {
      const user = model
        ? {
            id: model.id,
            email: model.email,
            username: model.username,
            avatar: model.avatar || '',
            created: model.created || new Date().toISOString().replace('T', ' '),
            updated: model.updated || new Date().toISOString().replace('T', ' '),
          }
        : null

      callback(token, user)
    })
  }
}

// 导出单例实例
export const pocketbaseAuthAdapter = new PocketBaseAuthAdapter()
