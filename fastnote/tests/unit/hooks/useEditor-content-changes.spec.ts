import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { useNoteEditor } from '@/features/note-editor'

describe('editor loaded content baseline', () => {
  it('treats normalized empty content as unchanged and deliberate deletion as an edit', () => {
    let api!: ReturnType<typeof useNoteEditor>
    const wrapper = mount(defineComponent({
      setup() {
        api = useNoteEditor()
        return () => h('div')
      },
    }))
    try {
      expect(api.setContent('<p>尚未初始化</p>')).toBe(false)
      expect(api.hasContentChanged()).toBe(false)
      api.initEditor()
      api.setContent('')
      expect(api.getContent()).toBe('<p></p>')
      expect(api.hasContentChanged()).toBe(false)

      api.setContent('<p>原正文</p>')
      expect(api.hasContentChanged()).toBe(false)
      const editor = api.editor.value!
      editor.commands.selectAll()
      editor.commands.deleteSelection()
      expect(api.getContent()).toBe('<p></p>')
      expect(api.hasContentChanged()).toBe(true)

      // Returning to the loaded document is still an edit: an intermediate
      // version may already have been saved on blur.
      editor.commands.setContent('<p>原正文</p>')
      expect(api.getContent()).toBe('<p>原正文</p>')
      expect(api.hasContentChanged()).toBe(true)

      api.setContent('<p>重新加载的正文</p>')
      expect(api.hasContentChanged()).toBe(false)
      editor.commands.insertContent('新增文本')
      expect(api.hasContentChanged()).toBe(true)
    }
    finally {
      wrapper.unmount()
    }
    expect(api.hasContentChanged()).toBe(false)
  })
})
