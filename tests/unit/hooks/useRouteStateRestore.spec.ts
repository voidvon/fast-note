import type { Router } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { createRouteStateRestoreManager } from '@/hooks/useRouteStateRestore'

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

describe('useRouteStateRestore', () => {
  it('resets child folder on push and restores parent folder on pop', () => {
    const manager = createRouteStateRestoreManager()
    const { router, emitTransition } = createRouterStub()
    manager.setRouter(router)

    emitTransition('/f/folder-b', '/f/folder-a')
    expect(manager.resolveFolderEnterMode('/f/folder-b')).toBe('reset')

    window.dispatchEvent(new PopStateEvent('popstate'))
    emitTransition('/f/folder-a', '/f/folder-b')
    expect(manager.resolveFolderEnterMode('/f/folder-a')).toBe('restore')

    manager.destroy()
  })

  it('restores folder when returning from note detail via pop navigation', () => {
    const manager = createRouteStateRestoreManager()
    const { router, emitTransition } = createRouterStub()
    manager.setRouter(router)

    emitTransition('/n/note-1', '/f/folder-b')
    expect(manager.resolveFolderEnterMode('/n/note-1')).toBe('reset')

    window.dispatchEvent(new PopStateEvent('popstate'))
    emitTransition('/f/folder-b', '/n/note-1')
    expect(manager.resolveFolderEnterMode('/f/folder-b')).toBe('restore')

    manager.destroy()
  })

  it('resets folder when entering from home with push navigation even if visited before', () => {
    const manager = createRouteStateRestoreManager()
    const { router, emitTransition } = createRouterStub()
    manager.setRouter(router)

    emitTransition('/f/folder-b', '/home')
    expect(manager.resolveFolderEnterMode('/f/folder-b')).toBe('reset')

    emitTransition('/home', '/f/folder-b')
    expect(manager.resolveFolderEnterMode('/home')).toBe('reset')

    emitTransition('/f/folder-b', '/home')
    expect(manager.resolveFolderEnterMode('/f/folder-b')).toBe('reset')

    manager.destroy()
  })
})
