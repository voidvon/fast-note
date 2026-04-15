import type { UserInfo } from '@/shared/types'

export interface AuthResult {
  success: boolean
  user?: UserInfo
  error?: string
}

export type AuthChangeCallback = (token: string | null, user: UserInfo | null) => void

export interface IAuthService {
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string, passwordConfirm: string, username?: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  getCurrentUser: () => Promise<AuthResult>
  getCurrentAuthUser: () => UserInfo | null
  isAuthenticated: () => boolean
  getToken: () => string | null
  onAuthChange: (callback: AuthChangeCallback) => () => void
}
