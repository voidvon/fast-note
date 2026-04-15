import { beforeEach, describe, expect, it, vi } from 'vitest'

function createTable<T extends Record<string, any>>(items: T[], keyField: keyof T) {
  const state = [...items]

  return {
    bulkPut: vi.fn(async (records: T[]) => {
      for (const record of records) {
        const key = record[keyField]
        const index = state.findIndex(item => item[keyField] === key)
        if (index > -1) {
          state[index] = record
        }
        else {
          state.push(record)
        }
      }
    }),
    clear: vi.fn(async () => {
      state.length = 0
    }),
    count: vi.fn(async () => state.length),
    toArray: vi.fn(async () => [...state]),
  }
}

describe('guest-data storage helpers', () => {
  function runTransaction(_mode: string, ...args: any[]) {
    const callback = args[args.length - 1]
    return callback()
  }

  beforeEach(() => {
    vi.resetModules()
  })

  it('treats metadata-only guest records as guest data', async () => {
    const guestDb = {
      close: vi.fn(),
      metadata: createTable([{ key: 'draft-mode', value: 'guest' }], 'key'),
      note_files: createTable([], 'hash'),
      notes: createTable([], 'id'),
      transaction: vi.fn(runTransaction),
      user_info: createTable([], 'id'),
    }

    vi.doMock('@/shared/lib/storage/dexie', () => ({
      openIsolatedDatabase: vi.fn(async () => guestDb),
      useDexie: () => ({ db: { value: null } }),
    }))

    const { getGuestDataStats, hasGuestData } = await import('@/shared/lib/storage/guest-data')

    await expect(getGuestDataStats()).resolves.toEqual({
      metadata: 1,
      noteFiles: 0,
      notes: 0,
      userInfo: 0,
    })
    await expect(hasGuestData()).resolves.toBe(true)
  })

  it('merges guest metadata and user info without overwriting existing login data', async () => {
    const guestDb = {
      close: vi.fn(),
      metadata: createTable([
        { key: 'guest-only', value: 'keep-me' },
        { key: 'shared-key', value: 'guest-value' },
      ], 'key'),
      note_files: createTable([], 'hash'),
      notes: createTable([], 'id'),
      transaction: vi.fn(runTransaction),
      user_info: createTable([
        { id: 'user-b', username: 'guest-b', name: 'Guest B' },
        { id: 'user-a', username: 'guest-overwrite', name: 'Guest Override' },
      ], 'id'),
    }

    const currentDb = {
      metadata: createTable([
        { key: 'shared-key', value: 'current-value' },
      ], 'key'),
      note_files: createTable([], 'hash'),
      notes: createTable([], 'id'),
      transaction: vi.fn(runTransaction),
      user_info: createTable([
        { id: 'user-a', username: 'current-a', name: 'Current A' },
      ], 'id'),
    }

    vi.doMock('@/shared/lib/logger', () => ({
      logger: {
        info: vi.fn(),
      },
    }))
    vi.doMock('@/shared/lib/storage/dexie', () => ({
      openIsolatedDatabase: vi.fn(async () => guestDb),
      useDexie: () => ({ db: { value: currentDb } }),
    }))

    const { mergeGuestDataIntoCurrent } = await import('@/shared/lib/storage/guest-data')

    await expect(mergeGuestDataIntoCurrent()).resolves.toEqual({
      metadataUpserted: 1,
      noteFilesUpserted: 0,
      notesUpserted: 0,
      userInfoUpserted: 1,
    })

    expect(currentDb.metadata.bulkPut).toHaveBeenCalledWith([
      { key: 'guest-only', value: 'keep-me' },
    ])
    expect(currentDb.user_info.bulkPut).toHaveBeenCalledWith([
      { id: 'user-b', username: 'guest-b', name: 'Guest B' },
    ])
    expect(guestDb.metadata.clear).toHaveBeenCalled()
    expect(guestDb.user_info.clear).toHaveBeenCalled()
  })
})
