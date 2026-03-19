import { describe, expect, it } from 'vitest'
import { getRouteRestoreMode, isDeferredPrivateRoute } from '@/processes/navigation'

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
})
