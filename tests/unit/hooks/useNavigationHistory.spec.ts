import type { Router } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useNavigationHistory } from '@/hooks/useNavigationHistory'

function createRouterStub() {
  let afterEachHandler: ((to: { fullPath: string }, from: { fullPath: string }) => void) | null = null
  const currentRoute = ref({ fullPath: '/home' })

  const replace = vi.fn(async (target: string | { path: string }) => {
    const nextPath = typeof target === 'string' ? target : target.path
    const fromPath = currentRoute.value.fullPath
    currentRoute.value = { fullPath: nextPath }
    afterEachHandler?.(
      { fullPath: nextPath },
      { fullPath: fromPath },
    )
  })

  const router = {
    currentRoute,
    afterEach: (handler: (to: { fullPath: string }, from: { fullPath: string }) => void) => {
      afterEachHandler = handler
      return () => {
        afterEachHandler = null
      }
    },
    replace,
  } as unknown as Router

  return {
    emitTransition(toPath: string, fromPath: string) {
      currentRoute.value = { fullPath: toPath }
      afterEachHandler?.(
        { fullPath: toPath },
        { fullPath: fromPath },
      )
    },
    replace,
    router,
  }
}

describe('useNavigationHistory', () => {
  beforeEach(() => {
    useNavigationHistory().clearHistory()
    window.history.replaceState(null, '', '/')
  })

  it('replaces orphan note detail history when falling back to a folder list', () => {
    const navigationHistory = useNavigationHistory()
    const { router, emitTransition } = createRouterStub()
    navigationHistory.setRouter(router)

    emitTransition('/n/note-1', '/home')
    expect(navigationHistory.getHistory.value.map(item => item.path)).toEqual(['/n/note-1'])

    emitTransition('/f/folder-a', '/n/note-1')
    expect(navigationHistory.getHistory.value.map(item => item.path)).toEqual(['/f/folder-a'])
  })

  it('keeps normal folder to detail back navigation intact', () => {
    const navigationHistory = useNavigationHistory()
    const { router, emitTransition } = createRouterStub()
    navigationHistory.setRouter(router)

    emitTransition('/f/folder-a', '/home')
    emitTransition('/n/note-1', '/f/folder-a')
    emitTransition('/f/folder-a', '/n/note-1')

    expect(navigationHistory.getHistory.value.map(item => item.path)).toEqual(['/f/folder-a'])
  })

  it('builds a restore back stack from persisted history', () => {
    const navigationHistory = useNavigationHistory()
    const { router, emitTransition } = createRouterStub()
    navigationHistory.setRouter(router)

    emitTransition('/f/folder-a', '/home')
    emitTransition('/n/note-1', '/f/folder-a')

    expect(navigationHistory.getRestoreBackStack('/n/note-1')).toEqual(['/f/folder-a'])
  })

  it('consumes virtual back stack step by step after restoring a route', async () => {
    const navigationHistory = useNavigationHistory()
    const { router, emitTransition, replace } = createRouterStub()
    navigationHistory.setRouter(router)

    emitTransition('/f/folder-a', '/home')
    emitTransition('/n/note-1', '/f/folder-a')

    expect(navigationHistory.installRestoredRouteVirtualBackStack(router, '/n/note-1')).toEqual(['/f/folder-a'])
    expect(window.history.state.__flashnoteVirtualBackCurrent).toBe(true)

    window.dispatchEvent(new PopStateEvent('popstate', {
      state: {
        __flashnoteVirtualBack: {
          remaining: [],
          target: '/f/folder-a',
        },
      },
    }))

    await Promise.resolve()

    expect(replace).toHaveBeenCalledWith('/f/folder-a')
    expect(navigationHistory.getHistory.value.map(item => item.path)).toEqual(['/f/folder-a'])
  })

  it('re-arms virtual back stack for multiple restored history levels', async () => {
    const navigationHistory = useNavigationHistory()
    const { router, emitTransition, replace } = createRouterStub()
    navigationHistory.setRouter(router)

    emitTransition('/f/folder-a', '/home')
    emitTransition('/n/note-1', '/f/folder-a')
    emitTransition('/f/folder-b', '/n/note-1')

    expect(navigationHistory.installRestoredRouteVirtualBackStack(router, '/f/folder-b')).toEqual([
      '/f/folder-a',
      '/n/note-1',
    ])

    window.dispatchEvent(new PopStateEvent('popstate', {
      state: {
        __flashnoteVirtualBack: {
          remaining: ['/f/folder-a'],
          target: '/n/note-1',
        },
      },
    }))

    await Promise.resolve()

    expect(replace).toHaveBeenLastCalledWith('/n/note-1')
    expect(window.history.state.__flashnoteVirtualBackCurrent).toBe(true)

    window.dispatchEvent(new PopStateEvent('popstate', {
      state: {
        __flashnoteVirtualBack: {
          remaining: [],
          target: '/f/folder-a',
        },
      },
    }))

    await Promise.resolve()

    expect(replace).toHaveBeenLastCalledWith('/f/folder-a')
    expect(window.history.state.__flashnoteVirtualBackCurrent).toBe(true)
  })
})
