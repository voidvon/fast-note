import { describe, expect, it } from 'vitest'
import {
  hasGlobalSearchOverlay,
  shouldUseRouteBackForGlobalSearchClose,
  withGlobalSearchHistoryState,
  withGlobalSearchOverlay,
  withoutGlobalSearchOverlay,
} from '@/features/global-search/model/search-route'

describe('global search route helpers', () => {
  it('detects and applies the search overlay query flag', () => {
    const query = withGlobalSearchOverlay({ foo: 'bar' })

    expect(query).toEqual({
      foo: 'bar',
      overlay: 'search',
    })
    expect(hasGlobalSearchOverlay(query)).toBe(true)
  })

  it('removes only the overlay query flag when closing search', () => {
    const query = withoutGlobalSearchOverlay({
      foo: 'bar',
      overlay: 'search',
      tags: ['a', 'b'],
    })

    expect(query).toEqual({
      foo: 'bar',
      tags: ['a', 'b'],
    })
  })

  it('marks internally pushed overlay history entries for route-back close', () => {
    const state = withGlobalSearchHistoryState({
      replaced: false,
      scroll: {
        top: 120,
      },
    })

    expect(shouldUseRouteBackForGlobalSearchClose(state)).toBe(true)
    expect(state).toMatchObject({
      replaced: false,
      globalSearchOverlay: true,
      scroll: {
        top: 120,
      },
    })
  })

  it('does not use route-back close for direct entries without the marker', () => {
    expect(shouldUseRouteBackForGlobalSearchClose({})).toBe(false)
    expect(shouldUseRouteBackForGlobalSearchClose(null)).toBe(false)
  })
})
