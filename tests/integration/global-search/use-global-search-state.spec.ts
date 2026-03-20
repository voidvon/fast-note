import { afterEach, describe, expect, it } from 'vitest'
import { useGlobalSearch } from '@/features/global-search'

function resetGlobalSearchState() {
  const { resetGlobalSearch } = useGlobalSearch()
  resetGlobalSearch()
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
    first.searchKeyword.value = '会议'

    expect(second.showGlobalSearch.value).toBe(true)
    expect(second.showGlobalSearchState.value).toBe('enterActive')
    expect(second.searchKeyword.value).toBe('会议')
  })
})
