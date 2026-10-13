import type { NoteLockViewSnapshot } from '@/features/note-lock'
import type { Note } from '@/shared/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { makeNote } from '../../factories/note.factory'
import { deferred, mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

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
    vi.useRealTimers()
    vi.doUnmock('@/shared/ui/f7')
    vi.resetModules()
  })

  it.each(['unlocked', 'locked', 'cooldown'] as const)(
    'waits for the local session before rendering the %s view',
    async (viewState) => {
      const note = makeNote({ id: 'restored-note', is_locked: 1, content: '<p>本地正文</p>' })
      const session = deferred<NoteLockViewSnapshot>()
      const cloudBootstrap = deferred<void>()
      const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
        noteId: note.id,
        notesById: { [note.id]: note },
        getLockViewStateImpl: () => session.promise,
        waitForSyncBootstrapImpl: () => cloudBootstrap.promise,
      })

      expect(wrapper.find('[data-testid="note-unlock-panel"]').exists()).toBe(false)
      expect(wrapper.findComponent({ name: 'YYEditor' }).exists()).toBe(false)
      expect(wrapper.findComponent({ name: 'NoteEditorToolbar' }).exists()).toBe(false)
      expect(editorApi.setContent).not.toHaveBeenCalled()

      session.resolve({
        viewState,
        failedAttempts: viewState === 'cooldown' ? 3 : 0,
        cooldownUntil: viewState === 'cooldown' ? Date.now() + 30_000 : null,
        biometricEnabled: false,
        deviceSupportsBiometric: false,
        session: null,
      })
      await flushPromises()

      expect(wrapper.find('[data-testid="note-unlock-panel"]').exists())
        .toBe(viewState !== 'unlocked')
      expect(wrapper.findComponent({ name: 'YYEditor' }).exists()).toBe(viewState === 'unlocked')
      if (viewState === 'unlocked') {
        expect(editorApi.setContent).toHaveBeenLastCalledWith(note.content)
      }
      else {
        expect(editorApi.setContent).not.toHaveBeenCalled()
      }
      expect(mocks.waitForSyncBootstrapMock).not.toHaveBeenCalled()
      expect(mocks.waitForSyncIdleMock).not.toHaveBeenCalled()
      expect(mocks.verifyPinMock).not.toHaveBeenCalled()
      expect(mocks.updateNoteMock).not.toHaveBeenCalled()
      wrapper.unmount()
    },
  )

  it('does not save the empty editor before private note loading completes', async () => {
    vi.useFakeTimers()
    const note = makeNote({ id: 'pending-note', content: '<p>尚未加载的正文</p>' })
    const loading = deferred<Note>()
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: note.id,
      getNoteImpl: () => loading.promise,
    })
    editorApi.getContent.mockReturnValue('<p></p>')
    wrapper.findComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await vi.advanceTimersByTimeAsync(800)
    window.dispatchEvent(new Event('pagehide'))
    await flushPromises()
    expect(mocks.getNoteMock).toHaveBeenCalledOnce()
    expect(mocks.updateNoteMock).not.toHaveBeenCalled()
    expect(mocks.manualSyncMock).toHaveBeenCalledOnce()

    loading.resolve(note)
    await flushPromises()
    expect(editorApi.setContent).toHaveBeenLastCalledWith(note.content)
    wrapper.unmount()
  })

  it('cancels an unlock waiting on bootstrap even if the same note is selected again', async () => {
    const note = makeNote({ id: 'locked-note', is_locked: 1, content: '<p>原正文</p>' })
    const bootstrap = deferred<void>()
    const { wrapper, mocks } = await mountNoteDetailForSaveTest({
      noteId: note.id,
      notesById: { [note.id]: note },
      lockViewState: 'locked',
      waitForSyncBootstrapImpl: () => bootstrap.promise,
    })
    await wrapper.get('[data-testid="note-unlock-panel-submit"]').trigger('click')
    await wrapper.setProps({ noteId: '' })
    await flushPromises()
    await wrapper.setProps({ noteId: note.id })
    await flushPromises()

    bootstrap.resolve()
    await flushPromises()
    expect(mocks.verifyPinMock).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="note-unlock-panel"]').exists()).toBe(true)

    await wrapper.get('[data-testid="note-unlock-panel-submit"]').trigger('click')
    await flushPromises()
    expect(mocks.verifyPinMock).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="note-unlock-panel"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('does not overwrite a synced note with an untouched normalized empty editor', async () => {
    vi.useFakeTimers()
    const note = makeNote({ id: 'locked-note', is_locked: 1, content: '' })
    const notesById = { [note.id]: note }
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: note.id,
      notesById,
      lockViewState: 'locked',
    })
    await wrapper.get('[data-testid="note-unlock-panel-submit"]').trigger('click')
    await flushPromises()
    editorApi.getContent.mockReturnValue('<p></p>')
    editorApi.hasContentChanged.mockReturnValue(false)
    notesById[note.id] = { ...note, content: '<p>稍后同步到的正文</p>' }

    wrapper.findComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await vi.advanceTimersByTimeAsync(800)
    await flushPromises()
    window.dispatchEvent(new Event('pagehide'))
    await flushPromises()
    expect(mocks.updateNoteMock).not.toHaveBeenCalled()
    expect(mocks.manualSyncMock).toHaveBeenCalledOnce()
    expect(notesById[note.id].content).toBe('<p>稍后同步到的正文</p>')
    await expect(
      wrapper.findComponent({ name: 'NoteMore' }).props('prepareForLock')(note.id),
    ).rejects.toThrow('当前编辑内容尚未保存，无法锁定')
    expect(mocks.updateNoteMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('uses the latest local content when sync completes during PIN verification', async () => {
    vi.useFakeTimers()
    const note = makeNote({ id: 'locked-note', is_locked: 1, content: '' })
    const notesById = { [note.id]: note }
    const verification = deferred<{
      ok: boolean
      code: string
      message: null
      failedAttempts: number
      cooldownUntil: null
    }>()
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: note.id,
      isPinLockNote: true,
      lockViewState: 'locked',
      notesById,
      verifyPinImpl: () => verification.promise,
    })
    let content = '<p></p>'
    editorApi.setContent.mockImplementation((value: string) => {
      content = value
    })
    editorApi.getContent.mockImplementation(() => content)

    await wrapper.get('[data-testid="note-unlock-panel-pin"]').setValue('123456')
    await wrapper.get('[data-testid="note-unlock-panel-submit"]').trigger('click')
    await flushPromises()
    expect(mocks.verifyPinMock).toHaveBeenCalledOnce()

    notesById[note.id] = { ...note, content: '<p>校验密码期间同步到的正文</p>' }
    verification.resolve({
      ok: true,
      code: 'ok',
      message: null,
      failedAttempts: 0,
      cooldownUntil: null,
    })
    await flushPromises()
    expect(content).toBe(notesById[note.id].content)

    wrapper.findComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await vi.advanceTimersByTimeAsync(800)
    await flushPromises()
    expect(mocks.updateNoteMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('ignores a PIN response after selecting a different note', async () => {
    vi.useFakeTimers()
    const lockedNote = makeNote({ id: 'locked-note', is_locked: 1, content: '' })
    const nextNote = makeNote({ id: 'next-note', content: '<p>下一篇正文</p>' })
    const verification = deferred<{
      ok: boolean
      code: string
      message: null
      failedAttempts: number
      cooldownUntil: null
    }>()
    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: lockedNote.id,
      notesById: { [lockedNote.id]: lockedNote, [nextNote.id]: nextNote },
      verifyPinImpl: () => verification.promise,
      getLockViewStateImpl: async () => ({
        viewState: 'locked',
        failedAttempts: 0,
        cooldownUntil: null,
        biometricEnabled: false,
        deviceSupportsBiometric: false,
        session: null,
      }),
    })
    let content = ''
    editorApi.setContent.mockImplementation((value: string) => {
      content = value
    })
    editorApi.getContent.mockImplementation(() => content)
    await wrapper.get('[data-testid="note-unlock-panel-submit"]').trigger('click')
    await flushPromises()
    await wrapper.setProps({ noteId: nextNote.id })
    await flushPromises()
    expect(content).toBe(nextNote.content)

    verification.resolve({
      ok: true,
      code: 'ok',
      message: null,
      failedAttempts: 0,
      cooldownUntil: null,
    })
    await flushPromises()
    expect(content).toBe(nextNote.content)
    wrapper.findComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await vi.advanceTimersByTimeAsync(800)
    await flushPromises()
    expect(mocks.updateNoteMock).not.toHaveBeenCalled()
    wrapper.unmount()
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

  it('waits for the initial sync and unlocks with the latest note content', async () => {
    vi.useFakeTimers()
    const noteId = 'locked-note'
    const localNote: Note = {
      id: noteId,
      title: '加锁备忘录',
      summary: '本地摘要',
      content: '',
      created: '2026-03-10 10:00:00',
      updated: '2026-03-10 10:00:00',
      item_type: 2,
      parent_id: '',
      is_deleted: 0,
      is_locked: 1,
      note_count: 0,
      version: 1,
      files: [],
    }
    const cloudNote: Note = {
      ...localNote,
      summary: '云端摘要',
      content: '<p>云端正文</p>',
      updated: '2026-03-10 10:05:00',
    }
    const notesById: Record<string, Note> = { [noteId]: localNote }
    const syncBootstrap = deferred<void>()
    const { wrapper, editorApi, notesRef, mocks } = await mountNoteDetailForSaveTest({
      noteId,
      isPinLockNote: true,
      lockViewState: 'locked',
      notesById,
      waitForSyncBootstrapImpl: () => syncBootstrap.promise,
      verifyPinImpl: async () => ({
        ok: true,
        code: 'ok',
        message: null,
        failedAttempts: 0,
        cooldownUntil: null,
      }),
    })

    let currentContent = '<p></p>'
    editorApi.getContent.mockImplementation(() => currentContent)
    editorApi.setContent.mockImplementation((content: string) => {
      currentContent = content || '<p></p>'
    })

    await wrapper.get('[data-testid="note-unlock-panel-pin"]').setValue('123456')
    await wrapper.get('[data-testid="note-unlock-panel-submit"]').trigger('click')
    await nextTick()

    expect(mocks.waitForSyncBootstrapMock).toHaveBeenCalledOnce()
    expect(mocks.waitForSyncIdleMock).not.toHaveBeenCalled()
    expect(mocks.verifyPinMock).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="note-unlock-panel"]').exists()).toBe(true)

    notesById[noteId] = cloudNote
    notesRef.value.splice(0, 1, cloudNote)
    syncBootstrap.resolve()
    await flushPromises()
    await nextTick()
    await nextTick()

    expect(mocks.verifyPinMock).toHaveBeenCalledWith(noteId, '123456')
    expect(editorApi.setContent).toHaveBeenCalledWith(cloudNote.content)
    expect(currentContent).toBe(cloudNote.content)

    wrapper.findComponent({ name: 'YYEditor' }).vm.$emit('blur')
    vi.advanceTimersByTime(800)
    await flushPromises()

    expect(mocks.updateNoteMock).not.toHaveBeenCalled()
  })
})
