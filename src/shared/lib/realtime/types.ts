export enum RealtimeStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

export interface RealtimeEvent<T = any> {
  action: 'create' | 'update' | 'delete'
  record: T
}

export interface RealtimeConfig {
  autoReconnect?: boolean
  maxReconnectAttempts?: number
  reconnectDelay?: number
  onStatusChange?: (status: RealtimeStatus) => void
  onError?: (error: Error) => void
  onMessage?: (event: RealtimeEvent) => void
}

export interface IRealtimeService {
  connect: () => Promise<void>
  disconnect: () => void
  getStatus: () => RealtimeStatus
  isConnected: () => boolean
  subscribe?: <T = any>(collection: string, callback: (event: RealtimeEvent<T>) => void) => Promise<() => void>
}
