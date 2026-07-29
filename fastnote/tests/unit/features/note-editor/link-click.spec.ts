import type { EditorView } from '@tiptap/pm/view'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleEditableLinkClick, hasOpenLinkModifier } from '@/features/note-editor/lib/link-click'

function createClick(target: Element, modifiers: Partial<MouseEventInit> = {}) {
  const event = new MouseEvent('click', {
    bubbles: true,
    button: 0,
    cancelable: true,
    ...modifiers,
  })
  Object.defineProperty(event, 'target', { value: target })
  return event
}

function createEditor() {
  const element = document.createElement('div')
  document.body.appendChild(element)

  return new Editor({
    element,
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
        },
      }),
    ],
    content: '<p><a href="https://example.com/docs">example</a></p>',
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('rich-text link clicks', () => {
  it('uses Command on macOS and Control on Windows', () => {
    expect(hasOpenLinkModifier({ altKey: false, ctrlKey: false, metaKey: true, shiftKey: false }, true)).toBe(true)
    expect(hasOpenLinkModifier({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: false }, true)).toBe(false)
    expect(hasOpenLinkModifier({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: false }, false)).toBe(true)
    expect(hasOpenLinkModifier({ altKey: false, ctrlKey: false, metaKey: true, shiftKey: false }, false)).toBe(false)
  })

  it('keeps a plain click in the editor without opening the link', () => {
    const editor = createEditor()
    const link = editor.view.dom.querySelector('a') as HTMLAnchorElement
    const open = vi.fn()
    const event = createClick(link)

    expect(handleEditableLinkClick(editor.view as EditorView, 2, event, { macPlatform: true, open })).toBe(true)
    expect(event.defaultPrevented).toBe(true)
    expect(open).not.toHaveBeenCalled()
    expect(editor.state.selection.from).toBe(2)

    editor.destroy()
  })

  it.each([
    ['macOS', true, { metaKey: true }],
    ['Windows', false, { ctrlKey: true }],
  ])('opens the link with the platform modifier on %s', (_name, macPlatform, modifiers) => {
    const editor = createEditor()
    const link = editor.view.dom.querySelector('a') as HTMLAnchorElement
    const open = vi.fn()
    const event = createClick(link, modifiers)

    expect(handleEditableLinkClick(editor.view as EditorView, 2, event, { macPlatform, open })).toBe(true)
    expect(event.defaultPrevented).toBe(true)
    expect(open).toHaveBeenCalledWith('https://example.com/docs', '_blank')

    editor.destroy()
  })

  it('leaves links in read-only content to the browser', () => {
    const editor = createEditor()
    editor.setEditable(false)
    const link = editor.view.dom.querySelector('a') as HTMLAnchorElement
    const event = createClick(link)

    expect(handleEditableLinkClick(editor.view as EditorView, 2, event)).toBe(false)
    expect(event.defaultPrevented).toBe(false)

    editor.destroy()
  })
})
