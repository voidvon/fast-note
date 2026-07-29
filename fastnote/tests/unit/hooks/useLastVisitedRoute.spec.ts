import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import {
  getLastVisitedRouteStorageKey,
  getRouteRestoreMode,
  isDeferredPrivateRoute,
  isPrivateWorkspaceRoute,
  shouldRestoreLastVisitedRouteForCurrentPath,
  useLastVisitedRoute,
} from '@/processes/navigation'

afterEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('useLastVisitedRoute restore mode', () => {
  it('treats private existing note detail routes as deferred restore targets', () => {
    expect(isDeferredPrivateRoute('/n/note-1')).toBe(true)
    expect(isDeferredPrivateRoute('/n/note-1?parent_id=folder-1')).toBe(true)
    expect(getRouteRestoreMode('/n/note-1')).toBe('deferred')
  })

  it('keeps new draft and public routes in immediate restore mode', () => {
    expect(isDeferredPrivateRoute('/n/0')).toBe(false)
    expect(isDeferredPrivateRoute('/n/0?parent_id=folder-1')).toBe(false)
    expect(isDeferredPrivateRoute('/alice/n/note-1')).toBe(false)
    expect(isDeferredPrivateRoute('/home')).toBe(false)
    expect(getRouteRestoreMode('/n/0')).toBe('immediate')
    expect(getRouteRestoreMode('/alice')).toBe('immediate')
  })

  it('only treats private workspace paths as restorable routes', () => {
    expect(isPrivateWorkspaceRoute('/home')).toBe(true)
    expect(isPrivateWorkspaceRoute('/deleted')).toBe(true)
    expect(isPrivateWorkspaceRoute('/n/note-1?parent_id=folder-1')).toBe(true)
    expect(isPrivateWorkspaceRoute('/f/folder-1')).toBe(true)
    expect(isPrivateWorkspaceRoute('/alice')).toBe(false)
    expect(isPrivateWorkspaceRoute('/alice/f/folder-1')).toBe(false)
    expect(isPrivateWorkspaceRoute('/alice/n/note-1')).toBe(false)
  })

  it('restores last visited route only from entry pages', () => {
    expect(shouldRestoreLastVisitedRouteForCurrentPath('/')).toBe(true)
    expect(shouldRestoreLastVisitedRouteForCurrentPath('/home')).toBe(true)
    expect(shouldRestoreLastVisitedRouteForCurrentPath('/login')).toBe(true)
    expect(shouldRestoreLastVisitedRouteForCurrentPath('/register')).toBe(true)
    expect(shouldRestoreLastVisitedRouteForCurrentPath('/n/private-note')).toBe(false)
    expect(shouldRestoreLastVisitedRouteForCurrentPath('/f/folder-1')).toBe(false)
    expect(shouldRestoreLastVisitedRouteForCurrentPath('/alice')).toBe(false)
  })

  it('persists a desktop native-history route in the current user scope', () => {
    const { saveVisitedRoute } = useLastVisitedRoute()

    saveVisitedRoute('/n/note-b', 'user-a')

    expect(localStorage.getItem(getLastVisitedRouteStorageKey('user-a'))).toBe('/n/note-b')
  })

  it('does not persist public routes as the last private workspace', () => {
    const { saveVisitedRoute } = useLastVisitedRoute()

    saveVisitedRoute('/voidvon', null)
    saveVisitedRoute('/voidvon/n/public-note', 'user-a')

    expect(localStorage.getItem(getLastVisitedRouteStorageKey(null))).toBeNull()
    expect(localStorage.getItem(getLastVisitedRouteStorageKey('user-a'))).toBeNull()
  })

  it('clears a legacy public route instead of restoring it from an entry page', async () => {
    const storageKey = getLastVisitedRouteStorageKey(null)
    localStorage.setItem(storageKey, '/voidvon')
    const router = {
      currentRoute: { value: { fullPath: '/home' } },
      replace: vi.fn(),
    } as any

    const restoredRoute = await useLastVisitedRoute().restoreImmediateLastVisitedRoute(router, null)

    expect(restoredRoute).toBeNull()
    expect(router.replace).not.toHaveBeenCalled()
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  it('saves the browser address instead of a stale router route before window close', () => {
    const routerAfterEach = vi.fn(() => vi.fn())
    const router = {
      afterEach: routerAfterEach,
      currentRoute: {
        value: {
          fullPath: '/n/note-a',
          name: undefined,
        },
      },
    } as any
    const wrapper = mount(defineComponent({
      setup() {
        const { setupAutoSave } = useLastVisitedRoute()
        setupAutoSave(router, 'user-a')
        return () => null
      },
    }))
    window.history.replaceState(null, '', '/n/note-b')
    window.dispatchEvent(new Event('beforeunload'))

    expect(localStorage.getItem(getLastVisitedRouteStorageKey('user-a'))).toBe('/n/note-b')
    wrapper.unmount()
  })
})
