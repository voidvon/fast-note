import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

function createF7Stub(name: string, tag = 'div') {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(tag, attrs, slots.default ? slots.default() : [])
    },
  })
}

function createButtonStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    emits: ['click'],
    setup(_, { attrs, slots, emit }) {
      return () => h('button', {
        ...attrs,
        type: 'button',
        onClick: (event: MouseEvent) => emit('click', event),
      }, slots.default ? slots.default() : [])
    },
  })
}

function createInputStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: {
      type: String,
      value: String,
    },
    emits: ['input'],
    setup(props, { attrs, emit }) {
      return () => h('input', {
        ...attrs,
        type: props.type,
        value: props.value,
        onInput: (event: Event) => emit('input', event),
      })
    },
  })
}

describe('note lock setup modal integration (t-fn-037 / tc-fn-028)', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('creates a global pin and locks the note when biometric is unsupported', async () => {
    const setupGlobalPinMock = vi.fn(async () => ({
      ok: true,
      code: 'ok',
      message: null,
      note: {
        id: 'note-1',
        is_locked: 1,
      },
    }))

    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({
        isDesktop: ref(false),
      }),
    }))
    vi.doMock('@/features/note-lock/model/use-note-lock', () => ({
      useNoteLock: () => ({
        enableLockForNote: vi.fn(),
        setupGlobalPin: setupGlobalPinMock,
      }),
    }))
    vi.doMock('@/shared/ui/f7', () => ({
      F7Button: createButtonStub('F7Button'),
      F7List: createF7Stub('F7List'),
      F7ListInput: createInputStub('F7ListInput'),
      F7Modal: createF7Stub('F7Modal'),
    }))

    const NoteLockSetupModal = (await import('@/features/note-lock/ui/note-lock-setup-modal.vue')).default
    const wrapper = mount(NoteLockSetupModal, {
      props: {
        isOpen: true,
        noteId: 'note-1',
        deviceSupportsBiometric: false,
        defaultBiometricEnabled: true,
        prepareForLock: vi.fn(async () => undefined),
      },
    })

    await wrapper.get('[data-testid="note-lock-setup-pin"]').setValue('123456')
    expect(wrapper.get('[data-testid="note-lock-setup-pin"]').attributes('type')).toBe('text')
    expect(wrapper.findComponent({ name: 'F7ListInput' }).exists()).toBe(true)

    const biometricInput = wrapper.get('[data-testid="note-lock-setup-biometric"]')
    expect((biometricInput.element as HTMLInputElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('设置全局 PIN')

    await wrapper.get('[data-testid="note-lock-setup-submit"]').trigger('click')
    await flushPromises()

    expect(setupGlobalPinMock).toHaveBeenCalledWith('note-1', '123456', '123456', {
      biometricEnabled: false,
    })
    expect(wrapper.emitted('confirm')?.[0]?.[0]?.note).toMatchObject({
      id: 'note-1',
      is_locked: 1,
    })
  })

  it('locks the note directly when a global pin already exists', async () => {
    const callOrder: string[] = []
    const prepareForLock = vi.fn(async () => {
      callOrder.push('persist-editor')
    })
    const enableLockForNoteMock = vi.fn(async () => {
      callOrder.push('enable-lock')
      return {
        ok: true,
        code: 'ok',
        message: null,
        note: {
          id: 'note-1',
          is_locked: 1,
        },
      }
    })

    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({
        isDesktop: ref(false),
      }),
    }))
    vi.doMock('@/features/note-lock/model/use-note-lock', () => ({
      useNoteLock: () => ({
        enableLockForNote: enableLockForNoteMock,
        setupGlobalPin: vi.fn(),
      }),
    }))
    vi.doMock('@/shared/ui/f7', () => ({
      F7Button: createButtonStub('F7Button'),
      F7List: createF7Stub('F7List'),
      F7ListInput: createInputStub('F7ListInput'),
      F7Modal: createF7Stub('F7Modal'),
    }))

    const NoteLockSetupModal = (await import('@/features/note-lock/ui/note-lock-setup-modal.vue')).default
    const wrapper = mount(NoteLockSetupModal, {
      props: {
        isOpen: true,
        noteId: 'note-1',
        hasGlobalPin: true,
        deviceSupportsBiometric: true,
        defaultBiometricEnabled: true,
        prepareForLock,
      },
    })

    expect(wrapper.find('[data-testid="note-lock-setup-pin"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('锁定这篇备忘录')

    await wrapper.get('[data-testid="note-lock-setup-submit"]').trigger('click')
    await flushPromises()

    expect(enableLockForNoteMock).toHaveBeenCalledWith('note-1', {
      biometricEnabled: true,
    })
    expect(callOrder).toEqual(['persist-editor', 'enable-lock'])
    expect(wrapper.emitted('confirm')?.[0]?.[0]?.note).toMatchObject({
      id: 'note-1',
      is_locked: 1,
    })
  })
})
