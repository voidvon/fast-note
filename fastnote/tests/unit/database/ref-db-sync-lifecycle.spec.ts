import type { SyncableItem } from '@/shared/lib/storage'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useRefDBSync } from '@/shared/lib/storage/sync'

interface TestItem extends SyncableItem {
  id: string
}

function createTable(overrides: Record<string, unknown> = {}) {
  return {
    bulkDelete: vi.fn(async () => undefined),
    bulkPut: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    toArray: vi.fn(async () => []),
    ...overrides,
  }
}

async function settleInitialization() {
  await nextTick()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('ref database sync lifecycle', () => {
  it('cancels a pending debounced write when auto sync stops', async () => {
    const data = ref<TestItem[]>([])
    const table = createTable()
    const controller = useRefDBSync({ data, table: table as any, idField: 'id', debounceMs: 30 })
    await settleInitialization()

    data.value.push({ id: 'note-1', updated: '2026-07-31 10:00:00' })
    await nextTick()
    await controller.stopAutoSync()
    await new Promise(resolve => setTimeout(resolve, 40))

    expect(table.bulkPut).not.toHaveBeenCalled()
  })

  it('waits for an active database write before auto sync stops', async () => {
    let finishWrite!: () => void
    const writePending = new Promise<void>((resolve) => {
      finishWrite = resolve
    })
    const data = ref<TestItem[]>([])
    const table = createTable({ bulkPut: vi.fn(() => writePending) })
    const controller = useRefDBSync({ data, table: table as any, idField: 'id', debounceMs: 0 })
    await settleInitialization()

    data.value.push({ id: 'note-1', updated: '2026-07-31 10:00:00' })
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(table.bulkPut).toHaveBeenCalledOnce()

    let stopped = false
    const stopPromise = controller.stopAutoSync().then(() => {
      stopped = true
    })
    await Promise.resolve()
    expect(stopped).toBe(false)

    finishWrite()
    await stopPromise
    expect(stopped).toBe(true)
  })
})
