import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

function createIonicStub(name: string, tag = 'div', emits: string[] = []) {
  return defineComponent({
    name,
    inheritAttrs: false,
    emits,
    setup(_, { attrs, slots }) {
      return () => h(tag, attrs, slots.default ? slots.default() : [])
    },
  })
}

function createIconTextButtonStub() {
  return defineComponent({
    name: 'IconTextButton',
    inheritAttrs: false,
    emits: ['click'],
    props: {
      text: {
        type: String,
        required: true,
      },
    },
    setup(props, { attrs, emit }) {
      return () => h('button', {
        ...attrs,
        type: 'button',
        onClick: (event: MouseEvent) => emit('click', event),
      }, props.text)
    },
  })
}

function createLockModalStub(name: string, testId: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: {
      isOpen: {
        type: Boolean,
        default: false,
      },
    },
    setup(props) {
      return () => h('div', {
        'data-testid': testId,
        'data-open': String(props.isOpen),
      })
    },
  })
}

describe('note more lock entry integration', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('opens the setup modal only after the more sheet is dismissed on mobile', async () => {
    const getNoteMock = vi.fn(async () => ({
      id: 'note-1',
      is_locked: 0,
      is_public: 0,
    }))

    vi.doMock('@ionic/vue', () => ({
      IonCol: createIonicStub('IonCol'),
      IonGrid: createIonicStub('IonGrid'),
      IonModal: createIonicStub('IonModal', 'div', ['will-present', 'did-dismiss']),
      IonRow: createIonicStub('IonRow'),
      toastController: {
        create: vi.fn(async () => ({
          present: vi.fn(),
        })),
      },
      useIonRouter: () => ({
        back: vi.fn(),
      }),
    }))
    vi.doMock('vue-router', () => ({
      useRoute: () => ({
        params: {
          id: 'note-1',
        },
      }),
    }))
    vi.doMock('@/stores', () => ({
      useNote: () => ({
        getNote: getNoteMock,
        updateNote: vi.fn(),
        updateParentFolderSubcount: vi.fn(),
      }),
    }))
    vi.doMock('@/database', () => ({
      useDexie: () => ({
        db: ref({}),
      }),
    }))
    vi.doMock('@/hooks/useNoteLock', () => ({
      useNoteLock: () => ({
        getDeviceSecurityState: vi.fn(async () => ({
          biometric_enabled: 1,
        })),
        hasGlobalPin: vi.fn(async () => true),
        isBiometricSupported: vi.fn(() => true),
        isPinLockNote: vi.fn(() => false),
      }),
    }))
    vi.doMock('@/components/IconTextButton.vue', () => ({
      default: createIconTextButtonStub(),
    }))
    vi.doMock('@/components/NoteLockSetupModal.vue', () => ({
      default: createLockModalStub('NoteLockSetupModal', 'note-lock-setup-modal'),
    }))
    vi.doMock('@/components/NoteLockManageModal.vue', () => ({
      default: createLockModalStub('NoteLockManageModal', 'note-lock-manage-modal'),
    }))

    const NoteMore = (await import('@/components/NoteMore.vue')).default
    const wrapper = mount(NoteMore, {
      props: {
        isOpen: true,
        noteId: 'note-1',
      },
    })

    const modal = wrapper.findComponent({ name: 'IonModal' })
    modal.vm.$emit('will-present')
    await flushPromises()

    expect(getNoteMock).toHaveBeenCalledWith('note-1')

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('update:isOpen')?.[0]).toEqual([false])
    expect(wrapper.get('[data-testid="note-lock-setup-modal"]').attributes('data-open')).toBe('false')

    modal.vm.$emit('did-dismiss')
    await flushPromises()

    expect(wrapper.get('[data-testid="note-lock-setup-modal"]').attributes('data-open')).toBe('true')
    expect(wrapper.get('[data-testid="note-lock-manage-modal"]').attributes('data-open')).toBe('false')
  })

  it('opens the manage modal only after the more sheet is dismissed for locked notes', async () => {
    vi.doMock('@ionic/vue', () => ({
      IonCol: createIonicStub('IonCol'),
      IonGrid: createIonicStub('IonGrid'),
      IonModal: createIonicStub('IonModal', 'div', ['will-present', 'did-dismiss']),
      IonRow: createIonicStub('IonRow'),
      toastController: {
        create: vi.fn(async () => ({
          present: vi.fn(),
        })),
      },
      useIonRouter: () => ({
        back: vi.fn(),
      }),
    }))
    vi.doMock('vue-router', () => ({
      useRoute: () => ({
        params: {
          id: 'note-2',
        },
      }),
    }))
    vi.doMock('@/stores', () => ({
      useNote: () => ({
        getNote: vi.fn(async () => ({
          id: 'note-2',
          is_locked: 1,
          is_public: 0,
        })),
        updateNote: vi.fn(),
        updateParentFolderSubcount: vi.fn(),
      }),
    }))
    vi.doMock('@/database', () => ({
      useDexie: () => ({
        db: ref({}),
      }),
    }))
    vi.doMock('@/hooks/useNoteLock', () => ({
      useNoteLock: () => ({
        getDeviceSecurityState: vi.fn(async () => ({
          biometric_enabled: 0,
        })),
        hasGlobalPin: vi.fn(async () => true),
        isBiometricSupported: vi.fn(() => true),
        isPinLockNote: vi.fn(() => true),
      }),
    }))
    vi.doMock('@/components/IconTextButton.vue', () => ({
      default: createIconTextButtonStub(),
    }))
    vi.doMock('@/components/NoteLockSetupModal.vue', () => ({
      default: createLockModalStub('NoteLockSetupModal', 'note-lock-setup-modal'),
    }))
    vi.doMock('@/components/NoteLockManageModal.vue', () => ({
      default: createLockModalStub('NoteLockManageModal', 'note-lock-manage-modal'),
    }))

    const NoteMore = (await import('@/components/NoteMore.vue')).default
    const wrapper = mount(NoteMore, {
      props: {
        isOpen: true,
        noteId: 'note-2',
      },
    })

    const modal = wrapper.findComponent({ name: 'IonModal' })
    modal.vm.$emit('will-present')
    await flushPromises()

    await wrapper.get('button').trigger('click')
    expect(wrapper.get('[data-testid="note-lock-manage-modal"]').attributes('data-open')).toBe('false')

    modal.vm.$emit('did-dismiss')
    await flushPromises()

    expect(wrapper.get('[data-testid="note-lock-manage-modal"]').attributes('data-open')).toBe('true')
    expect(wrapper.get('[data-testid="note-lock-setup-modal"]').attributes('data-open')).toBe('false')
  })
})
