import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolvePocketBaseUrl } from '@/shared/api/pocketbase/client'

describe('resolvePocketBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to same-origin relative root when no env override exists', () => {
    vi.stubEnv('VITE_POCKETBASE_URL', '')

    expect(resolvePocketBaseUrl()).toBe('/')
  })

  it('prefers VITE_POCKETBASE_URL when configured', () => {
    vi.stubEnv('VITE_POCKETBASE_URL', 'https://api.example.com')

    expect(resolvePocketBaseUrl()).toBe('https://api.example.com')
  })
})
