import type { IAuthService } from '@/shared/lib/auth'
import type { UserInfo } from '@/shared/types'
import type { PublicUserInfo } from '@/shared/types/pocketbase'
import { pocketbaseAuthService } from '@/shared/api/pocketbase/auth-service'
import { pb } from '@/shared/api/pocketbase/client'
import { usersService } from '@/shared/api/pocketbase/users'

export interface CurrentUserPinSettings {
  note_lock_pin_salt: string | null
  note_lock_pin_hash: string | null
  note_lock_pin_version: number | null
  updated?: string | null
}

export interface CurrentUserPinSettingsPayload {
  note_lock_pin_salt: string | null
  note_lock_pin_hash: string | null
  note_lock_pin_version: number | null
}

export interface AuthUsersService {
  getCurrentUserPinSettings: (options?: { force?: boolean }) => Promise<CurrentUserPinSettings | null>
  getPublicUserInfo: (username: string) => Promise<PublicUserInfo | null>
  updateCurrentUserPinSettings: (payload: CurrentUserPinSettingsPayload) => Promise<CurrentUserPinSettings | null>
}

const pendingPublicUserRequests = new Map<string, Promise<PublicUserInfo | null>>()

function toPublicUserInfo(record: any): PublicUserInfo | null {
  if (!record?.id || !record?.username) {
    return null
  }

  return {
    id: record.id,
    avatar: record.avatar ?? '',
    username: record.username,
  }
}

export const authService: IAuthService = {
  getCurrentAuthUser: () => pocketbaseAuthService.getCurrentAuthUser(),
  getCurrentUser: () => pocketbaseAuthService.getCurrentUser(),
  getToken: () => pocketbaseAuthService.getToken(),
  isAuthenticated: () => pocketbaseAuthService.isAuthenticated(),
  onAuthChange: callback => pocketbaseAuthService.onAuthChange(callback),
  signIn: (email, password) => pocketbaseAuthService.signIn(email, password),
  signOut: () => pocketbaseAuthService.signOut(),
  signUp: (email, password, passwordConfirm, username) => pocketbaseAuthService.signUp(email, password, passwordConfirm, username),
}

export const authUsersService: AuthUsersService = {
  async getCurrentUserPinSettings(options = {}) {
    return await usersService.getCurrentUserPinSettings(options)
  },
  async getPublicUserInfo(username: string) {
    const pendingRequest = pendingPublicUserRequests.get(username)
    if (pendingRequest) {
      return await pendingRequest
    }

    const request = (async () => {
      const record = await usersService.getUserByUsername(username)
      return toPublicUserInfo(record)
    })()
    pendingPublicUserRequests.set(username, request)

    try {
      return await request
    }
    finally {
      if (pendingPublicUserRequests.get(username) === request) {
        pendingPublicUserRequests.delete(username)
      }
    }
  },
  async updateCurrentUserPinSettings(payload) {
    return await usersService.updateCurrentUserPinSettings(payload)
  },
}

export function getUserAvatarUrl(user?: Pick<UserInfo, 'id' | 'avatar'> | null) {
  if (!user?.id || !user.avatar) {
    return ''
  }

  return pb.files.getURL(
    {
      id: user.id,
      collectionId: 'users',
      collectionName: 'users',
    },
    user.avatar,
  )
}
