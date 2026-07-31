import type { PublicNotesPage } from '@/shared/api/pocketbase'
import { authUsersService } from '@/entities/auth'
import { publicNoteRemoteService, useUserPublicNotes } from '@/entities/public-note'

const emptyPage: PublicNotesPage = {
  items: [],
  page: 1,
  perPage: 0,
  totalItems: 0,
  totalPages: 0,
}

export async function loadPublicFolderNotes(
  username: string,
  parentId: string,
  page = 1,
): Promise<PublicNotesPage> {
  if (!username || !parentId) {
    return emptyPage
  }

  const userInfo = await authUsersService.getPublicUserInfo(username)
  if (!userInfo) {
    return emptyPage
  }

  const result = await publicNoteRemoteService.getPublicNotesPage(userInfo.id, parentId, page)
  useUserPublicNotes(username).mergePublicNotes(result.items)
  return result
}
