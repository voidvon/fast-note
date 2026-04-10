import type { UserInfo } from './index'

export interface PublicUserInfo {
  id: string
  avatar: string
  username: string
}

export interface AuthResponse {
  success: boolean
  error?: string
  user?: UserInfo
  token?: string
}

export type RealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export interface RealtimeEvent<T = any> {
  action: 'create' | 'update' | 'delete'
  record: T
}

export interface RealtimeConfig {
  autoReconnect?: boolean
  onStatusChange?: (status: RealtimeStatus) => void
  onError?: (error: Error) => void
  onMessage?: (event: RealtimeEvent) => void
}
