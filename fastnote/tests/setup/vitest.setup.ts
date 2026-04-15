import { afterEach, beforeEach, vi } from 'vitest'
import { resetTestEnvironment } from './test-env'

beforeEach(() => {
  vi.useRealTimers()
  resetTestEnvironment()
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})
