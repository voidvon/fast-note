import { disposeNotesContext, initializeNotes } from '@/entities/note'
import { getCurrentDatabaseName, initializeDatabase } from '@/shared/lib/storage'
import { getScopedDatabaseName } from '@/shared/lib/user-scope'

let sessionContextQueue = Promise.resolve()

export function prepareSessionContext(userId?: string | null) {
  const databaseName = getScopedDatabaseName(userId)
  const operation = sessionContextQueue.then(async () => {
    if (getCurrentDatabaseName() !== databaseName)
      await disposeNotesContext()

    await initializeDatabase(userId)
    await initializeNotes()
  })

  sessionContextQueue = operation.catch(() => undefined)
  return operation
}
