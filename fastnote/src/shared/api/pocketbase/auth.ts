import type { UserInfo } from '@/shared/types'
import type { AuthResponse } from '@/shared/types/pocketbase'
import { mapErrorMessage, pb } from './client'

export const authService = {
  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const authData = await pb.collection('users').authWithPassword(email, password)

      return {
        success: true,
        user: authData.record as unknown as UserInfo,
        token: authData.token,
      }
    }
    catch (error: any) {
      console.error('PocketBase 登录错误:', error)
      return {
        success: false,
        error: mapErrorMessage(error),
      }
    }
  },

  async signUp(email: string, password: string, passwordConfirm: string, username?: string): Promise<AuthResponse> {
    try {
      const userData = {
        email,
        password,
        passwordConfirm,
        username,
        emailVisibility: false,
      }

      await pb.collection('users').create(userData)

      const authData = await pb.collection('users').authWithPassword(email, password)

      return {
        success: true,
        user: authData.record as unknown as UserInfo,
        token: authData.token,
      }
    }
    catch (error: any) {
      console.error('PocketBase 注册错误:', error)

      let errorMessage = mapErrorMessage(error)
      if (error?.data?.data) {
        const data = error.data.data
        if (data.email?.message) {
          errorMessage = '邮箱格式无效或已存在'
        }
        else if (data.password?.message) {
          errorMessage = '密码不符合要求'
        }
        else if (data.passwordConfirm?.message) {
          errorMessage = '两次输入的密码不一致'
        }
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  },

  async signOut(): Promise<AuthResponse> {
    try {
      pb.authStore.clear()
      return {
        success: true,
      }
    }
    catch (error: any) {
      console.error('PocketBase 登出错误:', error)
      return {
        success: false,
        error: mapErrorMessage(error),
      }
    }
  },

  async getCurrentUser(): Promise<AuthResponse> {
    try {
      if (!pb.authStore.isValid) {
        return {
          success: false,
          error: '未找到有效的认证信息',
        }
      }

      const authData = await pb.collection('users').authRefresh()

      return {
        success: true,
        user: authData.record as unknown as UserInfo,
        token: authData.token,
      }
    }
    catch (error: any) {
      console.error('获取当前用户错误:', error)
      pb.authStore.clear()
      return {
        success: false,
        error: mapErrorMessage(error),
      }
    }
  },

  isAuthenticated(): boolean {
    return pb.authStore.isValid
  },

  getToken(): string | null {
    return pb.authStore.token || null
  },

  getCurrentAuthUser(): any | null {
    if (!pb.authStore.isValid || !pb.authStore.model) {
      return null
    }
    return pb.authStore.model
  },

  onAuthChange(callback: (token: string, model: any) => void): () => void {
    return pb.authStore.onChange(callback)
  },
}

export { authService as authApi }
