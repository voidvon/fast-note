import type { AppRouteLocation } from '@/shared/lib/framework7'
import { describe, expect, it } from 'vitest'
import { useFolderBackButton } from '@/processes/navigation/model/use-smart-back-button'

function createRoute(path: string): AppRouteLocation {
  return {
    fullPath: path,
    path,
    query: {},
    params: {},
    hash: '',
  }
}

describe('useFolderBackButton', () => {
  it('uses the hierarchical parent after a nested private folder refresh', () => {
    const route = createRoute('/f/_dJsVWOGkGaZ/i_5YDamsg8cy')

    const { backButtonProps } = useFolderBackButton(route)

    expect(backButtonProps.value).toEqual({
      text: '返回',
      defaultHref: '/f/_dJsVWOGkGaZ',
      deterministic: true,
    })
  })

  it('returns home from a top-level private folder', () => {
    const route = createRoute('/f/_dJsVWOGkGaZ')

    const { backButtonProps } = useFolderBackButton(route)

    expect(backButtonProps.value.defaultHref).toBe('/home')
  })
})
