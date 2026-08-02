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
        ...(slots.list ? slots.list() : []),
        ...(slots.media ? slots.media() : []),
        ...(slots['before-title'] ? slots['before-title']() : []),
        ...(slots.title ? slots.title() : []),
        ...(slots.after ? slots.after() : []),
        ...(slots.header ? slots.header() : []),
        ...(slots.default ? slots.default() : []),
        ...(slots.content ? slots.content() : []),
      ])
    },
  })
}

function createPlainStub(name: string) {
  return defineComponent({
    name,
    template: `<div class="${name}-stub" />`,
  })
}

async function mountNoteList(options: {
  darkMode?: boolean
}) {
  vi.resetModules()
  localStorage.clear()
  document.documentElement.classList.toggle('app-theme-dark', !!options.darkMode)

  vi.doMock('@/shared/lib/device', () => ({
    useDeviceType: () => ({
      isDesktop: ref(false),
    }),
  }))
  vi.doMock('@/shared/lib/framework7', () => ({
    useLongPressList: vi.fn(),
  }))
  vi.doMock('vue-router', () => ({
    useRoute: () => ({
      path: '/home',
      params: {},
      name: 'Home',
    }),
  }))
  vi.doMock('@/features/note-actions-menu', () => ({
    default: createPlainStub('LongPressMenu'),
  }))
  vi.doMock('@/features/note-move', () => ({
    default: createPlainStub('NoteMove'),
  }))
  vi.doMock('@/features/note-move/ui/note-move-modal.vue', () => ({
    __isKeepAlive: false,
    __isTeleport: false,
    default: createPlainStub('NoteMoveModal'),
    name: 'NoteMoveModal',
  }))
  vi.doMock('@/features/note-lock', () => ({
    useNoteLockIndicatorState: () => ({
      indicatorStateMap: ref({
        'locked-note': 'locked',
        'unlocked-note': 'unlocked',
        'legacy-note': 'placeholder',
      }),
      refreshIndicatorStates: vi.fn(),
    }),
  }))
  vi.doMock('@/shared/ui/f7', () => ({
    F7Accordion: createF7Stub('F7Accordion'),
    F7AccordionGroup: createF7Stub('F7AccordionGroup'),
    F7Icon: createF7Stub('F7Icon', 'span'),
    F7Item: createF7Stub('F7Item'),
    F7Label: createF7Stub('F7Label'),
    F7List: createF7Stub('F7List'),
    F7Modal: createF7Stub('F7Modal'),
    F7Note: createF7Stub('F7Note', 'span'),
    useAppRoute: () => ({ path: '/home', params: {}, name: 'Home' }),
    useAppRouter: () => ({
      push: vi.fn(),
    }),
  }))

  const NoteList = (await import('@/widgets/note-list')).default
  const wrapper = mount(NoteList, {
    props: {
      allNotesCount: 4,
      dataList: [
        {
          originNote: makeNote({
            id: 'folder-1',
            title: '工作',
            item_type: 1,
            note_count: 2,
          }),
          children: [],
        },
        {
          originNote: makeNote({
            id: 'locked-note',
            title: '被锁定的超长标题备忘录，用来验证列表首行布局稳定',
            summary: '锁定项摘要',
            is_locked: 1,
          }),
          children: [],
        },
        {
          originNote: makeNote({
            id: 'unlocked-note',
            title: '已解锁的备忘录',
            summary: '应显示解锁图标',
            is_locked: 1,
          }),
          children: [],
        },
        {
          originNote: makeNote({
            id: 'legacy-note',
            title: '旧数据未锁定',
            summary: '缺失锁字段时也需要占位',
          }),
          children: [],
        },
      ],
      deletedNoteCount: 1,
      disabledLongPress: true,
      showAllNotes: true,
      showDelete: true,
      showUnfiledNotes: true,
    },
  })

  return wrapper
}

describe('note list lock indicator integration (t-fn-051 / tc-fn-047, tc-fn-048)', () => {
  afterEach(() => {
    document.documentElement.classList.remove('app-theme-dark')
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('renders lock indicators only for note rows in a mixed list', async () => {
    const wrapper = await mountNoteList({})

    expect(wrapper.findAll('[data-testid="note-leading-slot"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="note-lock-icon"]')).toHaveLength(2)
    expect(wrapper.findAll('.note-list-item--note').map(item => item.attributes('data-lock-state'))).toEqual([
      'locked',
      'unlocked',
      'placeholder',
    ])
    expect(wrapper.text()).toContain('工作')
    expect(wrapper.text()).toContain('旧数据未锁定')
    expect(wrapper.text()).toContain('已解锁的备忘录')
  })

  it('keeps the lock indicator visible in dark mode scenarios', async () => {
    const wrapper = await mountNoteList({
      darkMode: true,
    })

    expect(document.documentElement.classList.contains('app-theme-dark')).toBe(true)
    expect(wrapper.find('[data-testid="note-lock-icon"]').exists()).toBe(true)
    expect(wrapper.find('.note-list-item--note').attributes('data-lock-state')).toBe('locked')
    expect(wrapper.text()).toContain('被锁定的超长标题备忘录')
  })
})
