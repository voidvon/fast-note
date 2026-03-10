import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

function createIonicStub(name: string, tag = 'div') {
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

describe('note lock manage modal integration (t-fn-043 / tc-fn-036)', () => {
  it('supports change pin, relock and disable lock actions', async () => {
    vi.resetModules()

    const changeGlobalPinMock = vi.fn(async () => ({
      ok: true,
      code: 'ok',
      message: null,
    }))
    const relockMock = vi.fn(async () => undefined)
    const disableLockForNoteMock = vi.fn(async () => ({
      ok: true,
      code: 'ok',
      message: null,
      note: {
        id: 'note-1',
        is_locked: 0,
      },
    }))
    const setBiometricEnabledMock = vi.fn(async () => ({
      ok: true,
      code: 'ok',
      message: null,
      biometricEnabled: false,
    }))

    vi.doMock('@/hooks/useDeviceType', () => ({
      useDeviceType: () => ({
        isDesktop: ref(false),
      }),
    }))
    vi.doMock('@/hooks/useNoteLock', () => ({
      useNoteLock: () => ({
        changeGlobalPin: changeGlobalPinMock,
        disableLockForNote: disableLockForNoteMock,
        relock: relockMock,
        setBiometricEnabled: setBiometricEnabledMock,
      }),
    }))
    vi.doMock('@ionic/vue', () => ({
      IonButton: createButtonStub('IonButton'),
      IonModal: createIonicStub('IonModal'),
    }))

    const NoteLockManageModal = (await import('@/components/NoteLockManageModal.vue')).default
    const wrapper = mount(NoteLockManageModal, {
      props: {
        isOpen: true,
        noteId: 'note-1',
        note: {
          id: 'note-1',
          is_locked: 1,
        },
        deviceSupportsBiometric: true,
        biometricEnabled: true,
      },
    })

    await wrapper.get('[data-testid="note-lock-manage-change-pin"]').trigger('click')
    await wrapper.get('[data-testid="note-lock-manage-pin"]').setValue('123456')
    await wrapper.get('[data-testid="note-lock-manage-confirm-pin"]').setValue('123456')
    await wrapper.get('[data-testid="note-lock-manage-submit-pin"]').trigger('click')
    await flushPromises()

    expect(changeGlobalPinMock).toHaveBeenCalledWith('123456', '123456')
    expect(wrapper.emitted('updated')?.[0]?.[0]).toMatchObject({
      action: 'change_global_pin',
      note: expect.objectContaining({
        id: 'note-1',
        is_locked: 1,
      }),
    })

    await wrapper.setProps({ isOpen: false })
    await wrapper.setProps({ isOpen: true })
    await wrapper.get('[data-testid="note-lock-manage-relock"]').trigger('click')
    await flushPromises()

    expect(relockMock).toHaveBeenCalledWith('note-1')
    expect(wrapper.emitted('updated')?.[1]?.[0]).toMatchObject({
      action: 'relock',
      note: expect.objectContaining({
        id: 'note-1',
      }),
    })

    await wrapper.setProps({ isOpen: false })
    await wrapper.setProps({ isOpen: true })
    await wrapper.get('[data-testid="note-lock-manage-disable"]').trigger('click')
    await flushPromises()

    expect(disableLockForNoteMock).toHaveBeenCalledWith('note-1')
    expect(wrapper.emitted('updated')?.[2]?.[0]).toMatchObject({
      action: 'disable_lock',
      note: expect.objectContaining({
        id: 'note-1',
        is_locked: 0,
      }),
    })
  })
})
