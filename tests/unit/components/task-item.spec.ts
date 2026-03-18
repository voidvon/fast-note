import { Editor } from '@tiptap/core'
import { TaskList } from '@tiptap/extension-list'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TaskItem } from '@/shared/lib/editor/extensions/TaskItem'

describe('task item', () => {
  const mounts: HTMLElement[] = []
  const editors: Editor[] = []

  afterEach(() => {
    editors.splice(0).forEach(editor => editor.destroy())
    mounts.splice(0).forEach(element => element.remove())
  })

  it('prevents checkbox press from causing editor blur while preserving toggle behavior', () => {
    const element = document.createElement('div')
    document.body.appendChild(element)
    mounts.push(element)

    const editor = new Editor({
      element,
      extensions: [
        StarterKit,
        TaskList,
        TaskItem,
      ],
      content: `
        <ul data-type="taskList">
          <li data-type="taskItem" data-checked="false">
            <div><p>todo</p></div>
          </li>
        </ul>
      `,
    })
    editors.push(editor)

    const chainSpy = vi.spyOn(editor, 'chain')
    const checkbox = element.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    const checkboxWrapper = element.querySelector('label')

    expect(checkbox).not.toBeNull()
    expect(checkboxWrapper).not.toBeNull()

    const activationEventName = typeof window !== 'undefined' && 'PointerEvent' in window
      ? 'pointerdown'
      : 'mousedown'
    const pressEvent = new Event(activationEventName, { bubbles: true, cancelable: true })
    const dispatchResult = checkboxWrapper!.dispatchEvent(pressEvent)

    expect(dispatchResult).toBe(false)
    expect(pressEvent.defaultPrevented).toBe(true)
    expect(editor.getJSON().content?.[0]?.content?.[0]?.attrs?.checked).toBe(true)

    checkboxWrapper!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(chainSpy).not.toHaveBeenCalled()
    expect(editor.getJSON().content?.[0]?.content?.[0]?.attrs?.checked).toBe(true)
    expect(element.querySelector('li')?.getAttribute('data-checked')).toBe('true')
  })
})
