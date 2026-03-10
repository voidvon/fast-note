import { vi } from 'vitest'

export function createPocketBaseCollectionMock() {
  return {
    getFullList: vi.fn(),
    getFirstListItem: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}
