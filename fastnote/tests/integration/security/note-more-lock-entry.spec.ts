import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'

function createF7Stub(name: string, tag = 'div', emits: string[] = []) {
  return defineComponent({
    name,
    inheritAttrs: false,
    emits,
    setup(_, { attrs, slots }) {
      return () => h(tag, attrs, slots.default ? slots.default() : [])
    },
  })
}

function createF7ListItemStub() {
  return defineComponent({
    name: 'F7ListItem',
    inheritAttrs: false,
    emits: ['click'],
    props: {
      title: {
        type: String,
        required: true,
      },
    },
    setup(props, { attrs, emit }) {
      return () => h('button', {
        ...attrs,
        type: 'button',
        onClick: (event: MouseEvent) => emit('click', event),
      }, props.title)
    },
  })
}

function mockF7Primitives() {
  vi.doMock('framework7-vue', () => ({
    f7Link: createF7Stub('F7Link', 'button', ['click']),
    f7List: createF7Stub('F7List'),
    f7ListItem: createF7ListItemStub(),
    f7PageContent: createF7Stub('F7PageContent'),
    f7Toolbar: createF7Stub('F7Toolbar'),
  }))
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

function mockUseSync(syncMock = vi.fn(async () => null)) {
  vi.doMock('@/processes/sync-notes', () => ({
    useSync: () => ({
      sync: syncMock,
    }),
  }))

  return syncMock
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
    buildManageFeedback: vi.fn(payload => ({
      color: payload.code === 'ok' ? 'success' : 'warning',
      duration: 1500,
      message: payload.message || '已更新备忘录锁',
      note: payload.note,
    })),
    buildSetupFeedback: vi.fn(payload => ({
      color: payload.code === 'ok' ? 'success' : 'warning',
      duration: 2200,
      message: payload.message || '已启用备忘录锁',
      note: payload.note,
    })),
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

  it('opens the setup modal after the more sheet dismisses on mobile', async () => {
    interface AlertOptions {
      buttons: Array<{
        handler?: () => void
        role?: string
        text: string
      }>
      header: string
      message: string
    }

    const currentUser = ref<{ username: string } | null>(null)
    const isLoggedIn = ref(false)
    const getNoteMock = vi.fn(async () => ({
      id: 'note-1',
      is_locked: 0,
      is_public: 0,
    }))
    const noteLockFlow = createNoteLockFlowStub('setup')
    const alertPresent = vi.fn(async () => undefined)
    const alertCreate = vi.fn(async (_options: AlertOptions) => ({ present: alertPresent }))
    const routerPush = vi.fn()
    mockUseSync()
    mockF7Primitives()

    vi.doMock('@/shared/ui/f7', () => ({
      alertController: {
        create: alertCreate,
      },
      F7Modal: createF7Stub('F7Modal', 'div', ['will-present', 'did-dismiss']),
      toastController: {
        create: vi.fn(async () => ({
          present: vi.fn(),
        })),
      },
      useAppRouter: () => ({
        back: vi.fn(),
        push: routerPush,
      }),
    }))
    vi.doMock('@/processes/session', () => ({
      useAuth: () => ({ currentUser, isLoggedIn }),
    }))
    vi.doMock('@/shared/lib/framework7', () => ({
      cleanupOverlayLocksAsync: vi.fn(),
      useAppRoute: () => ({
        params: {
          id: 'note-1',
        },
      }),
    }))
    vi.doMock('@/entities/note', async () => {
      const actual = await vi.importActual<typeof import('@/entities/note')>('@/entities/note')
      return {
        ...actual,
        useNote: () => ({
          getNote: getNoteMock,
          updateNote: vi.fn(),
          updateParentFolderSubcount: vi.fn(),
        }),
      }
    })
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
      PublicNoteAccessModal: createLockModalStub('PublicNoteAccessModal', 'public-note-access-modal'),
    }))
    vi.doMock('@/shared/lib/logger', () => ({
      logger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    }))

    const NoteMore = (await import('@/widgets/note-more')).default
    const wrapper = mount(NoteMore, {
      props: {
        isOpen: true,
        noteId: 'note-1',
        prepareForLock: vi.fn(async () => undefined),
      },
    })

    const modal = wrapper.findComponent({ name: 'F7Modal' })
    modal.vm.$emit('will-present')
    await flushPromises()

    expect(getNoteMock).toHaveBeenCalledWith('note-1')

    await wrapper.get('[data-testid="note-more-lock-action"]').trigger('click')

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

    await wrapper.setProps({ isOpen: true })
    await wrapper.get('[data-testid="note-more-public-action"]').trigger('click')
    await flushPromises()

    expect(alertCreate).toHaveBeenCalledWith(expect.objectContaining({
      header: '请先登录',
      message: '登录后才能公开备忘录',
      buttons: [
        expect.objectContaining({ text: '取消', role: 'cancel' }),
        expect.objectContaining({ text: '去登录' }),
      ],
    }))
    expect(alertPresent).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="public-note-access-modal"]').attributes('data-open')).toBe('false')

    const alertOptions = alertCreate.mock.calls[0][0]
    alertOptions.buttons[1].handler?.()
    expect(routerPush).toHaveBeenCalledWith('/login')

    currentUser.value = { username: 'virjay' }
    isLoggedIn.value = true
    await wrapper.setProps({ isOpen: true })
    await wrapper.get('[data-testid="note-more-public-action"]').trigger('click')

    expect(wrapper.get('[data-testid="public-note-access-modal"]').attributes('data-open')).toBe('false')

    modal.vm.$emit('did-dismiss')
    await flushPromises()

    expect(wrapper.get('[data-testid="public-note-access-modal"]').attributes('data-open')).toBe('true')
  })

  it('opens the manage modal after the more sheet dismisses for locked notes', async () => {
    const noteLockFlow = createNoteLockFlowStub('manage')
    mockUseSync()
    mockF7Primitives()

    vi.doMock('@/shared/ui/f7', () => ({
      F7Modal: createF7Stub('F7Modal', 'div', ['will-present', 'did-dismiss']),
      toastController: {
        create: vi.fn(async () => ({
          present: vi.fn(),
        })),
      },
      useAppRouter: () => ({
        back: vi.fn(),
      }),
    }))
    vi.doMock('@/shared/lib/framework7', () => ({
      cleanupOverlayLocksAsync: vi.fn(),
      useAppRoute: () => ({
        params: {
          id: 'note-2',
        },
      }),
    }))
    vi.doMock('@/entities/note', async () => {
      const actual = await vi.importActual<typeof import('@/entities/note')>('@/entities/note')
      return {
        ...actual,
        useNote: () => ({
          getNote: vi.fn(async () => ({
            id: 'note-2',
            is_locked: 1,
            is_public: 0,
          })),
          updateNote: vi.fn(),
          updateParentFolderSubcount: vi.fn(),
        }),
      }
    })
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
      PublicNoteAccessModal: createLockModalStub('PublicNoteAccessModal', 'public-note-access-modal'),
    }))
    vi.doMock('@/shared/lib/logger', () => ({
      logger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    }))

    const NoteMore = (await import('@/widgets/note-more')).default
    const wrapper = mount(NoteMore, {
      props: {
        isOpen: true,
        noteId: 'note-2',
        prepareForLock: vi.fn(async () => undefined),
      },
    })

    const modal = wrapper.findComponent({ name: 'F7Modal' })
    modal.vm.$emit('will-present')
    await flushPromises()

    await wrapper.get('[data-testid="note-more-lock-action"]').trigger('click')
    expect(wrapper.get('[data-testid="note-lock-manage-modal"]').attributes('data-open')).toBe('false')

    modal.vm.$emit('did-dismiss')
    await flushPromises()

    expect(noteLockFlow.openPendingLockModal).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="note-lock-manage-modal"]').attributes('data-open')).toBe('true')
    expect(wrapper.get('[data-testid="note-lock-setup-modal"]').attributes('data-open')).toBe('false')
  })

  it('syncs the common note pipeline after lock setup confirms', async () => {
    const syncMock = mockUseSync()
    const presentMock = vi.fn()
    const toastCreateMock = vi.fn(async () => ({
      present: presentMock,
    }))
    const noteLockFlow = createNoteLockFlowStub('setup')
    mockF7Primitives()

    vi.doMock('@/shared/ui/f7', () => ({
      F7Modal: createF7Stub('F7Modal', 'div', ['will-present', 'did-dismiss']),
      toastController: {
        create: toastCreateMock,
      },
      useAppRouter: () => ({
        back: vi.fn(),
      }),
    }))
    vi.doMock('@/shared/lib/framework7', () => ({
      cleanupOverlayLocksAsync: vi.fn(),
      useAppRoute: () => ({
        params: {
          id: 'note-4',
        },
      }),
    }))
    vi.doMock('@/entities/note', async () => {
      const actual = await vi.importActual<typeof import('@/entities/note')>('@/entities/note')
      return {
        ...actual,
        useNote: () => ({
          getNote: vi.fn(async () => ({
            id: 'note-4',
            is_locked: 0,
            is_public: 0,
          })),
          updateNote: vi.fn(),
          updateParentFolderSubcount: vi.fn(),
        }),
      }
    })
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
      PublicNoteAccessModal: createLockModalStub('PublicNoteAccessModal', 'public-note-access-modal'),
    }))
    vi.doMock('@/shared/lib/logger', () => ({
      logger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    }))

    const NoteMore = (await import('@/widgets/note-more')).default
    const wrapper = mount(NoteMore, {
      props: {
        isOpen: true,
        noteId: 'note-4',
        prepareForLock: vi.fn(async () => undefined),
      },
    })

    wrapper.findComponent({ name: 'F7Modal' }).vm.$emit('will-present')
    await flushPromises()

    wrapper.findComponent({ name: 'NoteLockSetupModal' }).vm.$emit('confirm', {
      ok: true,
      code: 'ok',
      message: null,
      note: {
        id: 'note-4',
        is_locked: 1,
        is_public: 0,
      },
    })
    await flushPromises()

    expect(syncMock).toHaveBeenCalledWith(true)
    expect(wrapper.emitted('noteLockUpdated')?.[0]?.[0]).toMatchObject({
      id: 'note-4',
      is_locked: 1,
    })
    expect(toastCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      message: '已启用备忘录锁',
      color: 'success',
    }))
    expect(presentMock).toHaveBeenCalledTimes(1)

    wrapper.findComponent({ name: 'NoteLockManageModal' }).vm.$emit('updated', {
      action: 'relock',
      biometricEnabled: false,
      code: 'ok',
      message: null,
      note: {
        id: 'note-4',
        is_locked: 1,
        is_public: 0,
      },
    })
    await flushPromises()

    expect(syncMock).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('noteLockUpdated')?.[1]?.[0]).toMatchObject({
      id: 'note-4',
      is_locked: 1,
    })
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
    mockUseSync()
    mockF7Primitives()

    vi.doMock('@/shared/ui/f7', () => ({
      F7Modal: createF7Stub('F7Modal', 'div', ['will-present', 'did-dismiss']),
      toastController: {
        create: vi.fn(async () => ({
          present: vi.fn(),
        })),
      },
      useAppRouter: () => ({
        back: backMock,
      }),
    }))
    vi.doMock('@/shared/lib/framework7', () => ({
      cleanupOverlayLocksAsync: vi.fn(),
      useAppRoute: () => ({
        params: {
          id: 'note-3',
        },
      }),
    }))
    vi.doMock('@/entities/note', async () => {
      const actual = await vi.importActual<typeof import('@/entities/note')>('@/entities/note')
      return {
        ...actual,
        useNote: () => ({
          getNote: getNoteMock,
          updateNote: vi.fn(),
          updateParentFolderSubcount: vi.fn(),
        }),
      }
    })
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
      PublicNoteAccessModal: createLockModalStub('PublicNoteAccessModal', 'public-note-access-modal'),
    }))
    vi.doMock('@/shared/lib/logger', () => ({
      logger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    }))

    const NoteMore = (await import('@/widgets/note-more')).default
    const wrapper = mount(NoteMore, {
      props: {
        isOpen: true,
        noteId: 'note-3',
        prepareForLock: vi.fn(async () => undefined),
      },
    })

    const modal = wrapper.findComponent({ name: 'F7Modal' })
    modal.vm.$emit('will-present')
    await flushPromises()

    await wrapper.get('[data-testid="note-more-delete-action"]').trigger('click')
    await flushPromises()

    expect(deleteNoteMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'note-3',
    }))
    expect(backMock).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:isOpen')?.at(-1)).toEqual([false])
  })
})
