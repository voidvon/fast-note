import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { makeNote } from '../../factories/note.factory'

function createIonicStub(name: string, tag = 'div') {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(tag, attrs, [
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
  document.documentElement.classList.toggle('ion-palette-dark', !!options.darkMode)

  vi.doMock('@/hooks/useDeviceType', () => ({
    useDeviceType: () => ({
      isDesktop: ref(false),
    }),
  }))
  vi.doMock('@/hooks/useIonicLongPressList', () => ({
    useIonicLongPressList: vi.fn(),
  }))
  vi.doMock('vue-router', () => ({
    useRoute: () => ({
      path: '/home',
      params: {},
      name: 'Home',
    }),
  }))
  vi.doMock('@/components/LongPressMenu.vue', () => ({
    default: createPlainStub('LongPressMenu'),
  }))
  vi.doMock('@/components/NoteMove.vue', () => ({
    default: createPlainStub('NoteMove'),
  }))
  vi.doMock('@ionic/vue', () => ({
    IonAccordion: createIonicStub('IonAccordion'),
    IonAccordionGroup: createIonicStub('IonAccordionGroup'),
    IonIcon: createIonicStub('IonIcon', 'span'),
    IonItem: createIonicStub('IonItem'),
    IonLabel: createIonicStub('IonLabel'),
    IonList: createIonicStub('IonList'),
    IonNote: createIonicStub('IonNote', 'span'),
    useIonRouter: () => ({
      push: vi.fn(),
    }),
  }))

  const NoteList = (await import('@/components/NoteList.vue')).default
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
    document.documentElement.classList.remove('ion-palette-dark')
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('renders lock indicators only for note rows in a mixed list', async () => {
    const wrapper = await mountNoteList({})

    expect(wrapper.findAll('[data-testid="note-leading-slot"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="note-lock-icon"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('工作')
    expect(wrapper.text()).toContain('旧数据未锁定')
  })

  it('keeps the lock indicator visible in dark mode scenarios', async () => {
    const wrapper = await mountNoteList({
      darkMode: true,
    })

    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true)
    expect(wrapper.find('[data-testid="note-lock-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="note-leading-slot"]').attributes('data-lock-state')).toBe('locked')
    expect(wrapper.text()).toContain('被锁定的超长标题备忘录')
  })
})
