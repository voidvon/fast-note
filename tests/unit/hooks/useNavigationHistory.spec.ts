import type { Router } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useNavigationHistory } from '@/processes/navigation'

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
})
