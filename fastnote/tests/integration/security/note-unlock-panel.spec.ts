import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

function createF7Stub(name: string, tag = 'div') {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(tag, attrs, slots.default ? slots.default() : [])
    },
  })
}

function createInputStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: {
      autocomplete: String,
      inputId: String,
      name: String,
      outline: Boolean,
      placeholder: String,
      type: String,
      value: String,
    },
    emits: ['input'],
    setup(props, { attrs, emit }) {
      return () => h('input', {
        ...attrs,
        id: props.inputId,
        autocomplete: props.autocomplete,
        name: props.name,
        placeholder: props.placeholder,
        type: props.type,
        value: props.value,
        onInput: (event: Event) => emit('input', event),
      })
    },
  })
}

describe('note unlock panel integration (t-fn-038 / tc-fn-030)', () => {
  afterEach(() => {
    vi.doUnmock('@/shared/ui/f7')
    vi.resetModules()
  })

  it('uses a Framework7 outline field for the non-login password', async () => {
    vi.doMock('@/shared/ui/f7', () => ({
      F7Block: createF7Stub('F7Block'),
      F7Button: createF7Stub('F7Button', 'button'),
      F7Icon: createF7Stub('F7Icon', 'span'),
      F7List: createF7Stub('F7List'),
      F7ListInput: createInputStub('F7ListInput'),
    }))

    const NoteUnlockPanel = (await import('@/features/note-lock/ui/note-unlock-panel.vue')).default
    const wrapper = mount(NoteUnlockPanel, {
      props: {
        lockViewState: 'locked',
      },
    })
    const input = wrapper.get('input#note-unlock-panel-pin')

    expect(wrapper.get('[data-testid="note-unlock-panel"]').classes()).toEqual(expect.arrayContaining([
      'display-flex',
      'flex-direction-column',
      'justify-content-center',
    ]))
    expect(wrapper.findComponent({ name: 'F7List' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'F7List' }).classes()).toEqual(expect.arrayContaining([
      'display-inline-block',
      'no-margin-vertical',
      'width-auto',
    ]))
    expect(wrapper.findComponent({ name: 'F7ListInput' }).props('outline')).toBe(false)
    const blocks = wrapper.findAllComponents({ name: 'F7Block' })
    expect(blocks[0].classes()).toContain('text-align-center')
    expect(blocks[0].classes()).toContain('margin-bottom-half')
    expect(blocks[0].attributes('strong')).toBeUndefined()
    expect(blocks[1].classes()).toContain('no-margin-vertical')
    expect(blocks[2].classes()).toContain('margin-vertical-half')
    expect(input.attributes('type')).toBe('password')
    expect(input.attributes('autocomplete')).toBe('new-password')
    expect(input.attributes('name')).toBe('note-unlock-pin')
  })

  it('shows unlock panel before rendering the editor and unlocks with a valid pin', async () => {
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: 'locked-note',
      isPinLockNote: true,
      lockViewState: 'locked',
      notesById: {
        'locked-note': {
          id: 'locked-note',
          title: '加锁备忘录',
          summary: '测试摘要',
          content: '<p>锁内内容</p>',
          created: '2026-03-10 10:00:00',
          updated: '2026-03-10 10:00:00',
          item_type: 2,
          parent_id: '',
          is_deleted: 0,
          is_locked: 1,
          note_count: 0,
          version: 1,
          files: [],
        },
      },
      verifyPinImpl: async () => ({
        ok: true,
        code: 'ok',
        message: null,
        failedAttempts: 0,
        cooldownUntil: null,
      }),
    })

    expect(wrapper.find('[data-testid="note-unlock-panel"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('备忘录已锁定')
    expect(wrapper.text()).toContain('输入备忘录密码以查看')
    expect(wrapper.get('[data-testid="note-unlock-panel-pin"]').attributes('placeholder')).toBe('输入密码')
    expect(wrapper.get('[data-testid="note-unlock-panel-pin"]').attributes('type')).toBe('password')
    expect(wrapper.find('.yy-editor-stub').exists()).toBe(false)

    await wrapper.get('[data-testid="note-unlock-panel-pin"]').setValue('123456')
    await wrapper.get('[data-testid="note-unlock-panel-submit"]').trigger('click')
    await flushPromises()
    await nextTick()
    await nextTick()

    expect(mocks.verifyPinMock).toHaveBeenCalledWith('locked-note', '123456')
    expect(wrapper.find('[data-testid="note-unlock-panel"]').exists()).toBe(false)
    expect(wrapper.find('.yy-editor-stub').exists()).toBe(true)
    expect(editorApi.setContent).toHaveBeenCalledWith('<p>锁内内容</p>')
    expect(editorApi.setEditable).toHaveBeenCalledWith(true)
  })
})
