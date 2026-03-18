import { afterEach, describe, expect, it } from 'vitest'
import { useGlobalSearch } from '@/features/global-search'

function resetGlobalSearchState() {
  const { showGlobalSearch, showGlobalSearchState } = useGlobalSearch()
  showGlobalSearch.value = false
  showGlobalSearchState.value = 'hide'
}

describe('useGlobalSearch integration', () => {
  afterEach(() => {
    resetGlobalSearchState()
  })

  it('shares state between callers', () => {
    const first = useGlobalSearch()
    const second = useGlobalSearch()

    first.showGlobalSearch.value = true
    first.showGlobalSearchState.value = 'enterActive'

    expect(second.showGlobalSearch.value).toBe(true)
    expect(second.showGlobalSearchState.value).toBe('enterActive')
  })
})
