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
  vi.doMock('@ionic/vue', () => ({
    IonAccordion: createIonicStub('IonAccordion'),
    IonIcon: createIonicStub('IonIcon', 'span'),
    IonItem: createIonicStub('IonItem'),
    IonLabel: createIonicStub('IonLabel'),
    IonNote: createIonicStub('IonNote', 'span'),
    useIonRouter: () => ({
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

    expect(wrapper.get('[data-testid="note-leading-slot"]').attributes('data-lock-state')).toBe('locked')
    expect(wrapper.find('[data-testid="note-lock-icon"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('已锁定')
    expect(wrapper.text()).toContain('需要显示锁图标')
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

    expect(wrapper.get('[data-testid="note-leading-slot"]').attributes('data-lock-state')).toBe('unlocked')
    expect(wrapper.find('[data-testid="note-lock-icon"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('已临时解锁')
  })

  it('keeps the placeholder slot for unlocked notes and missing lock fields', async () => {
    const unlockedWrapper = await mountNoteListItem({
      note: makeNote({
        id: 'unlocked-note',
        title: '未锁定',
        is_locked: 0,
      }),
    })

    expect(unlockedWrapper.get('[data-testid="note-leading-slot"]').attributes('data-lock-state')).toBe('placeholder')
    expect(unlockedWrapper.find('[data-testid="note-lock-icon"]').exists()).toBe(false)

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

    expect(legacyWrapper.get('[data-testid="note-leading-slot"]').attributes('data-lock-state')).toBe('placeholder')
    expect(legacyWrapper.find('[data-testid="note-lock-icon"]').exists()).toBe(false)
  })
})
