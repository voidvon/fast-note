import { vi } from 'vitest'

export function createPocketBaseCollectionMock() {
  return {
    getFullList: vi.fn(),
    getFirstListItem: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}
