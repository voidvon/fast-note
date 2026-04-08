import { initializeNotes } from '@/entities/note'
import { initializeDatabase } from '@/shared/lib/storage'

export async function prepareSessionContext(userId?: string | null) {
  await initializeDatabase(userId)
  await initializeNotes()
}
