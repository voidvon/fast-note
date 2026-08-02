import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { makeNote } from '../../factories/note.factory'

function createF7Stub(name: string, tag = 'div') {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(tag, attrs, [
        ...(slots.media ? slots.media() : []),
        ...(slots['before-title'] ? slots['before-title']() : []),
        h('div', { class: 'item-title' }, slots.title ? slots.title() : []),
        ...(slots.subtitle ? [h('div', { class: 'item-subtitle' }, slots.subtitle())] : []),
        ...(slots.text ? [h('div', { class: 'item-text' }, slots.text())] : []),
        ...(slots.footer ? [h('div', { class: 'item-footer' }, slots.footer())] : []),
        ...(slots.after ? slots.after() : []),
        ...(slots.header ? slots.header() : []),
        ...(slots.default ? slots.default() : []),
        ...(slots.content ? slots.content() : []),
      ])
    },
  })
}

async function mountNoteListItem(options: {
  lockIndicatorStateMap?: Record<string, 'locked' | 'unlocked' | 'placeholder'>
  note?: Record<string, unknown>
}) {
  vi.resetModules()

  vi.doMock('@/shared/lib/device', () => ({
    useDeviceType: () => ({
      isDesktop: ref(false),
    }),
  }))
  vi.doMock('vue-router', () => ({
    useRoute: () => ({
      path: '/home',
      params: {},
      name: 'Home',
    }),
  }))
  vi.doMock('@/shared/ui/f7', () => ({
    F7Accordion: createF7Stub('F7Accordion'),
    F7Icon: createF7Stub('F7Icon', 'span'),
    F7Item: createF7Stub('F7Item'),
    F7Label: createF7Stub('F7Label'),
    F7List: createF7Stub('F7List'),
    F7Note: createF7Stub('F7Note', 'span'),
    useAppRoute: () => ({ path: '/home', params: {}, name: 'Home' }),
    useAppRouter: () => ({
      push: vi.fn(),
    }),
  }))

  const NoteListItem = (await import('@/widgets/note-list/ui/note-list-item.vue')).default
  const wrapper = mount(NoteListItem, {
    props: {
      disabledRoute: true,
      data: {
        originNote: options.note ?? makeNote({
          id: 'note-1',
          title: '锁定笔记',
          summary: '摘要内容',
          is_locked: 1,
        }),
        children: [],
      },
      lockIndicatorStateMap: options.lockIndicatorStateMap,
    },
  })

  return wrapper
}

describe('note list item lock indicator (t-fn-050 / tc-fn-045, tc-fn-046)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('shows a lock icon for locked notes', async () => {
    const wrapper = await mountNoteListItem({
      note: makeNote({
        id: 'locked-note',
        title: '已锁定',
        summary: '需要显示锁图标',
        is_locked: 1,
      }),
    })

    expect(wrapper.get('.note-list-item--note').attributes('data-lock-state')).toBe('locked')
    expect(wrapper.find('[data-testid="note-lock-icon"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('已锁定')
    expect(wrapper.text()).toContain('需要显示锁图标')
  })

  it('uses the Framework7 media-item text region for date and summary', async () => {
    const wrapper = await mountNoteListItem({
      note: makeNote({
        id: 'preview-note',
        title: '原生列表标题',
        summary: '原生列表摘要',
        created: '2024-01-02T03:04:05.000Z',
      }),
    })

    const item = wrapper.get('.note-list-item--note')
    expect(item.attributes()).toHaveProperty('media-item')
    expect(item.get('.item-title').text()).toBe('原生列表标题')
    expect(item.find('.item-subtitle').exists()).toBe(false)
    expect(item.get('.item-text').text()).toContain('2024/1/2')
    expect(item.get('.item-text').text()).toContain('原生列表摘要')
    expect(item.get('.item-text').text().indexOf('2024/1/2')).toBeLessThan(item.get('.item-text').text().indexOf('原生列表摘要'))
    expect(item.find('.note-label').exists()).toBe(false)
  })

  it('shows an unlocked icon state for notes with an active unlock session', async () => {
    const wrapper = await mountNoteListItem({
      lockIndicatorStateMap: {
        'unlocked-note': 'unlocked',
      },
      note: makeNote({
        id: 'unlocked-note',
        title: '已临时解锁',
        summary: '列表应显示解锁态',
        is_locked: 1,
      }),
    })

    expect(wrapper.get('.note-list-item--note').attributes('data-lock-state')).toBe('unlocked')
    expect(wrapper.find('[data-testid="note-lock-icon"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('已临时解锁')
  })

  it('does not reserve a leading slot for unlocked notes and missing lock fields', async () => {
    const unlockedWrapper = await mountNoteListItem({
      note: makeNote({
        id: 'unlocked-note',
        title: '未锁定',
        is_locked: 0,
      }),
    })

    expect(unlockedWrapper.get('.note-list-item--note').attributes('data-lock-state')).toBe('placeholder')
    expect(unlockedWrapper.find('[data-testid="note-lock-icon"]').exists()).toBe(false)
    expect(unlockedWrapper.find('[data-testid="note-leading-slot"]').exists()).toBe(false)

    const noteWithoutLockField = {
      ...makeNote({
        id: 'legacy-note',
        title: '旧数据',
      }),
    } as Record<string, unknown>
    delete noteWithoutLockField.is_locked

    const legacyWrapper = await mountNoteListItem({
      note: noteWithoutLockField,
    })

    expect(legacyWrapper.get('.note-list-item--note').attributes('data-lock-state')).toBe('placeholder')
    expect(legacyWrapper.find('[data-testid="note-lock-icon"]').exists()).toBe(false)
  })
})
