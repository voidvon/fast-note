import { afterEach, describe, expect, it, vi } from 'vitest'

describe('note store lifecycle', () => {
  afterEach(() => {
    vi.doUnmock('vue')
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('can be used outside component setup without registering a Vue lifecycle hook', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { useNote } = await import('@/entities/note')

    const noteStore = useNote()

    expect(noteStore.dispose).toEqual(expect.any(Function))
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('onUnmounted is called when there is no active component instance'),
    )
  })

  it('registers its idempotent subscription cleanup when used in component setup', async () => {
    const onUnmounted = vi.fn()
    vi.doMock('vue', async (importOriginal) => {
      const actual = await importOriginal<typeof import('vue')>()
      return {
        ...actual,
        getCurrentInstance: () => ({}),
        onUnmounted,
      }
    })

    const { useNote } = await import('@/entities/note')
    const noteStore = useNote()

    expect(onUnmounted).toHaveBeenCalledOnce()
    expect(onUnmounted).toHaveBeenCalledWith(noteStore.dispose)

    expect(() => noteStore.dispose()).not.toThrow()
    expect(() => noteStore.dispose()).not.toThrow()
  })
})
