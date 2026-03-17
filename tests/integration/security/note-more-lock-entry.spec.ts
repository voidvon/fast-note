import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'

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

function createNoteLockFlowStub(mode: 'setup' | 'manage') {
  const lockModalState = reactive({
    defaultBiometricEnabled: false,
    hasGlobalPin: false,
    isOpen: false,
    manageOpen: false,
  })
  let pendingModal: 'setup' | 'manage' | null = null

  return {
    buildManageFeedback: vi.fn(),
    buildSetupFeedback: vi.fn(),
    isBiometricSupported: vi.fn(() => true),
    lockModalState,
    openPendingLockModal: vi.fn(() => {
      if (pendingModal === 'manage') {
        lockModalState.manageOpen = true
      }
      else if (pendingModal === 'setup') {
        lockModalState.isOpen = true
      }

      pendingModal = null
    }),
    prepareLockModal: vi.fn(async () => {
      pendingModal = mode
    }),
  }
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
    const noteLockFlow = createNoteLockFlowStub('setup')

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
    vi.doMock('@/features/note-lock', () => ({
      NoteLockSetupModal: createLockModalStub('NoteLockSetupModal', 'note-lock-setup-modal'),
      NoteLockManageModal: createLockModalStub('NoteLockManageModal', 'note-lock-manage-modal'),
      useNoteLockModalFlow: () => noteLockFlow,
    }))
    vi.doMock('@/features/note-delete', () => ({
      useNoteDelete: () => ({
        deleteNote: vi.fn(),
      }),
    }))
    vi.doMock('@/features/public-note-share', () => ({
      usePublicNoteShare: () => ({
        toggleShare: vi.fn(),
      }),
    }))
    vi.doMock('@/components/IconTextButton.vue', () => ({
      default: createIconTextButtonStub(),
    }))

    const NoteMore = (await import('@/widgets/note-more')).default
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

    expect(noteLockFlow.prepareLockModal).toHaveBeenCalledWith(expect.objectContaining({
      id: 'note-1',
    }))
    expect(wrapper.emitted('update:isOpen')?.[0]).toEqual([false])
    expect(wrapper.get('[data-testid="note-lock-setup-modal"]').attributes('data-open')).toBe('false')

    modal.vm.$emit('did-dismiss')
    await flushPromises()

    expect(noteLockFlow.openPendingLockModal).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="note-lock-setup-modal"]').attributes('data-open')).toBe('true')
    expect(wrapper.get('[data-testid="note-lock-manage-modal"]').attributes('data-open')).toBe('false')
  })

  it('opens the manage modal only after the more sheet is dismissed for locked notes', async () => {
    const noteLockFlow = createNoteLockFlowStub('manage')

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
    vi.doMock('@/features/note-lock', () => ({
      NoteLockSetupModal: createLockModalStub('NoteLockSetupModal', 'note-lock-setup-modal'),
      NoteLockManageModal: createLockModalStub('NoteLockManageModal', 'note-lock-manage-modal'),
      useNoteLockModalFlow: () => noteLockFlow,
    }))
    vi.doMock('@/features/note-delete', () => ({
      useNoteDelete: () => ({
        deleteNote: vi.fn(),
      }),
    }))
    vi.doMock('@/features/public-note-share', () => ({
      usePublicNoteShare: () => ({
        toggleShare: vi.fn(),
      }),
    }))
    vi.doMock('@/components/IconTextButton.vue', () => ({
      default: createIconTextButtonStub(),
    }))

    const NoteMore = (await import('@/widgets/note-more')).default
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

    expect(noteLockFlow.openPendingLockModal).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="note-lock-manage-modal"]').attributes('data-open')).toBe('true')
    expect(wrapper.get('[data-testid="note-lock-setup-modal"]').attributes('data-open')).toBe('false')
  })

  it('deletes the note through feature use case and then navigates back', async () => {
    const backMock = vi.fn()
    const getNoteMock = vi.fn(async () => ({
      id: 'note-3',
      is_locked: 0,
      is_public: 0,
    }))
    const deleteNoteMock = vi.fn(async (note: { id: string }) => ({
      ok: true,
      note: {
        ...note,
        is_deleted: 1,
        updated: '2026-03-17 11:21:00',
      },
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
        back: backMock,
      }),
    }))
    vi.doMock('vue-router', () => ({
      useRoute: () => ({
        params: {
          id: 'note-3',
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
    vi.doMock('@/features/note-lock', () => ({
      NoteLockSetupModal: createLockModalStub('NoteLockSetupModal', 'note-lock-setup-modal'),
      NoteLockManageModal: createLockModalStub('NoteLockManageModal', 'note-lock-manage-modal'),
      useNoteLockModalFlow: () => createNoteLockFlowStub('setup'),
    }))
    vi.doMock('@/features/note-delete', () => ({
      useNoteDelete: () => ({
        deleteNote: deleteNoteMock,
      }),
    }))
    vi.doMock('@/features/public-note-share', () => ({
      usePublicNoteShare: () => ({
        toggleShare: vi.fn(),
      }),
    }))
    vi.doMock('@/components/IconTextButton.vue', () => ({
      default: createIconTextButtonStub(),
    }))

    const NoteMore = (await import('@/widgets/note-more')).default
    const wrapper = mount(NoteMore, {
      props: {
        isOpen: true,
        noteId: 'note-3',
      },
    })

    const modal = wrapper.findComponent({ name: 'IonModal' })
    modal.vm.$emit('will-present')
    await flushPromises()

    const buttons = wrapper.findAll('button')
    await buttons[2].trigger('click')
    await flushPromises()

    expect(deleteNoteMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'note-3',
    }))
    expect(backMock).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:isOpen')?.at(-1)).toEqual([false])
  })
})
