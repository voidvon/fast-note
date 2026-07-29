import { describe, expect, it } from 'vitest'
import { enqueueNoteSync, useSyncRuntimeState } from '@/processes/sync-notes/model/sync-runtime-state'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('note sync request queue', () => {
  it('runs requested syncs sequentially without overlapping cursor work', async () => {
    const firstGate = deferred()
    const secondGate = deferred()
    const events: string[] = []
    const { syncing } = useSyncRuntimeState()

    const first = enqueueNoteSync(async () => {
      events.push('first:start')
      await firstGate.promise
      events.push('first:end')
    })
    const second = enqueueNoteSync(async () => {
      events.push('second:start')
      await secondGate.promise
      events.push('second:end')
    })

    await Promise.resolve()
    expect(events).toEqual(['first:start'])
    expect(syncing.value).toBe(true)

    firstGate.resolve()
    await first
    await Promise.resolve()
    expect(events).toEqual(['first:start', 'first:end', 'second:start'])
    expect(syncing.value).toBe(true)

    secondGate.resolve()
    await second
    expect(events).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
    expect(syncing.value).toBe(false)
  })
})
