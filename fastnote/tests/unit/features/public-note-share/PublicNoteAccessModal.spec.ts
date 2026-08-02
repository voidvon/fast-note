import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { makeNote } from '../../../factories/note.factory'

function createF7Stub(name: string, tag = 'div') {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(tag, attrs, slots.default ? slots.default() : [])
    },
  })
}

describe('public note access modal', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('shows and copies the public note URL', async () => {
    const copyText = vi.fn(async () => true)
    const present = vi.fn(async () => undefined)
    const createToast = vi.fn(async () => ({ present }))

    vi.doMock('@/shared/ui/f7', () => ({
      F7Button: createF7Stub('F7Button', 'button'),
      F7Icon: createF7Stub('F7Icon', 'span'),
      F7Modal: createF7Stub('F7Modal'),
      F7Toggle: createF7Stub('F7Toggle', 'input'),
      toastController: {
        create: createToast,
      },
    }))
    vi.doMock('@/shared/lib/clipboard', () => ({ copyText }))
    vi.doMock('@/entities/note', () => ({
      useNote: () => ({
        getNote: vi.fn(),
        getNotesByParentId: vi.fn(async () => []),
        updateNote: vi.fn(),
      }),
    }))

    const PublicNoteAccessModal = (await import('@/features/public-note-share/ui/public-note-access-modal.vue')).default
    const wrapper = mount(PublicNoteAccessModal, {
      props: {
        isOpen: true,
        note: makeNote({
          id: 'note-1',
          is_public: true,
          item_type: 2,
        }),
        username: 'virjay',
      },
    })

    const expectedUrl = `${window.location.origin}/virjay/n/note-1`
    expect(wrapper.text()).toContain(expectedUrl)

    await wrapper.get('[aria-label="复制公开链接"]').trigger('click')

    expect(copyText).toHaveBeenCalledWith(expectedUrl)
    expect(createToast).toHaveBeenCalledWith({
      message: '公开链接已复制',
      duration: 2000,
      position: 'top',
    })
    expect(present).toHaveBeenCalledTimes(1)
  })
})
