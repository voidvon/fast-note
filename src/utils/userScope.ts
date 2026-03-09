import { authService } from '@/pocketbase'

export const GUEST_SCOPE_ID = 'guest'

export function resolveScopedUserId(userId?: string | null): string | null {
  if (typeof userId === 'string' && userId.trim())
    return userId

  return authService.getCurrentAuthUser()?.id || null
}

export function getScopeId(userId?: string | null): string {
  return resolveScopedUserId(userId) || GUEST_SCOPE_ID
}

export function createScopedStorageKey(prefix: string, userId?: string | null): string {
  return `${prefix}:${getScopeId(userId)}`
}

export function getScopedDatabaseName(userId?: string | null): string {
  return `note:${getScopeId(userId)}`
}
