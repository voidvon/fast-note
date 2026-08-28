import { describe, expect, it } from 'vitest'
import {
  beginSyncBootstrap,
  completeSyncBootstrap,
  enqueueNoteSync,
  useSyncRuntimeState,
  waitForSyncBootstrap,
  waitForSyncIdle,
} from '@/processes/sync-notes/model/sync-runtime-state'

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

    const idle = waitForSyncIdle()
    let idleResolved = false
    void idle.then(() => {
      idleResolved = true
    })
    await Promise.resolve()
    expect(idleResolved).toBe(false)

    firstGate.resolve()
    await first
    await Promise.resolve()
    expect(events).toEqual(['first:start', 'first:end', 'second:start'])
    expect(syncing.value).toBe(true)

    secondGate.resolve()
    await second
    await idle
    expect(events).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
    expect(syncing.value).toBe(false)
  })

  it('waits for the session sync bootstrap even before its queue task starts', async () => {
    beginSyncBootstrap()

    try {
      const bootstrap = waitForSyncBootstrap()
      let bootstrapResolved = false
      void bootstrap.then(() => {
        bootstrapResolved = true
      })

      await Promise.resolve()
      expect(bootstrapResolved).toBe(false)

      completeSyncBootstrap()
      await bootstrap
      expect(bootstrapResolved).toBe(true)
    }
    finally {
      completeSyncBootstrap()
    }
  })
})
