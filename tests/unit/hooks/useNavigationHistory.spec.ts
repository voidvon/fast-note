import type { Router } from 'vue-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { useNavigationHistory } from '@/hooks/useNavigationHistory'

function createRouterStub() {
  let afterEachHandler: ((to: { fullPath: string }, from: { fullPath: string }) => void) | null = null

  const router = {
    afterEach: (handler: (to: { fullPath: string }, from: { fullPath: string }) => void) => {
      afterEachHandler = handler
      return () => {
        afterEachHandler = null
      }
    },
  } as unknown as Router

  return {
    emitTransition(toPath: string, fromPath: string) {
      afterEachHandler?.(
        { fullPath: toPath },
        { fullPath: fromPath },
      )
    },
    router,
  }
}

describe('useNavigationHistory', () => {
  beforeEach(() => {
    useNavigationHistory().clearHistory()
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
