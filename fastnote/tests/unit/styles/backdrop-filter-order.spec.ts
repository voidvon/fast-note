import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const styleFiles = [
  'src/css/common.scss',
  'src/features/global-search/ui/global-search.vue',
]

describe('backdrop filter declaration order', () => {
  it.each(styleFiles)('keeps the standard property after the webkit prefix in %s', (styleFile) => {
    const declarations = readFileSync(resolve(styleFile), 'utf8')
      .split('\n')
      .map(line => line.trim())
    const hasSupportedPair = declarations.some((declaration, index) => {
      return declaration.startsWith('-webkit-backdrop-filter:')
        && declarations[index + 1]?.startsWith('backdrop-filter:')
    })
    const hasReversedPair = declarations.some((declaration, index) => {
      return declaration.startsWith('backdrop-filter:')
        && declarations[index + 1]?.startsWith('-webkit-backdrop-filter:')
    })

    expect(hasSupportedPair).toBe(true)
    expect(hasReversedPair).toBe(false)
  })
})
