import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, toRef } from 'vue'
import { makeNote } from '../../factories/note.factory'

async function mountIndicatorHarness(options: {
  dataList: Array<Record<string, unknown>>
  getLockViewState: (noteId: string) => Promise<any>
}) {
  vi.resetModules()

  const listeners = new Set<(event: { noteId: string }) => void>()
  const getLockViewState = vi.fn(options.getLockViewState)

  vi.doMock('@/hooks/useNoteLock', () => ({
    onNoteLockSessionChanged: (listener: (event: { noteId: string }) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    useNoteLock: () => ({
      getLockViewState,
    }),
  }))

  const { useNoteLockIndicatorState } = await import('@/hooks/useNoteLockIndicatorState')

  const Harness = defineComponent({
    props: {
      dataList: {
        required: true,
        type: Array,
      },
    },
    setup(props, { expose }) {
      const api = useNoteLockIndicatorState(toRef(props, 'dataList') as any)
      expose(api)
      return () => h('div')
    },
  })

  const wrapper = mount(Harness, {
    props: {
      dataList: options.dataList,
    },
  })

  await flushPromises()

  return {
    emitSessionChange(payload: { noteId: string }) {
      listeners.forEach(listener => listener(payload))
    },
    getLockViewState,
    wrapper,
  }
}

describe('useNoteLockIndicatorState', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.useRealTimers()
  })

  it('maps unlocked, locked, and placeholder states for visible notes', async () => {
    const { wrapper, getLockViewState } = await mountIndicatorHarness({
      dataList: [
        {
          originNote: makeNote({
            id: 'locked-note',
            is_locked: 1,
          }),
          children: [],
        },
        {
          originNote: makeNote({
            id: 'unlocked-note',
            is_locked: 1,
          }),
          children: [],
        },
        {
          originNote: makeNote({
            id: 'plain-note',
            is_locked: 0,
          }),
          children: [],
        },
      ],
      getLockViewState: async (noteId: string) => {
        if (noteId === 'unlocked-note') {
          return {
            viewState: 'unlocked',
            session: {
              expires_at: Date.now() + 60_000,
            },
          }
        }

        return {
          viewState: 'locked',
          session: null,
        }
      },
    })

    expect((wrapper.vm as any).indicatorStateMap).toEqual({
      'locked-note': 'locked',
      'plain-note': 'placeholder',
      'unlocked-note': 'unlocked',
    })
    expect(getLockViewState).toHaveBeenCalledTimes(2)
  })

  it('refreshes on session events and relocks when the unlock session expires', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-11T00:00:00.000Z'))

    const { wrapper, emitSessionChange } = await mountIndicatorHarness({
      dataList: [
        {
          originNote: makeNote({
            id: 'session-note',
            is_locked: 1,
          }),
          children: [],
        },
      ],
      getLockViewState: async () => {
        if (Date.now() < new Date('2026-03-11T00:00:05.000Z').getTime()) {
          return {
            viewState: 'unlocked',
            session: {
              expires_at: new Date('2026-03-11T00:00:05.000Z').getTime(),
            },
          }
        }

        return {
          viewState: 'locked',
          session: null,
        }
      },
    })

    expect((wrapper.vm as any).indicatorStateMap).toEqual({
      'session-note': 'unlocked',
    })

    emitSessionChange({
      noteId: 'session-note',
    })
    await flushPromises()

    expect((wrapper.vm as any).indicatorStateMap).toEqual({
      'session-note': 'unlocked',
    })

    await vi.advanceTimersByTimeAsync(5_100)
    await flushPromises()

    expect((wrapper.vm as any).indicatorStateMap).toEqual({
      'session-note': 'locked',
    })
  })
})
