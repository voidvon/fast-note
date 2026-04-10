import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TableWithWrapper } from '@/shared/lib/editor/extensions/TableWithWrapper'
import { TableCell, TableHeader, TableRow } from '@/shared/lib/editor/extensions/tiptap-table'

describe('table with wrapper', () => {
  const editors: Editor[] = []
  const mounts: HTMLElement[] = []

  afterEach(() => {
    editors.splice(0).forEach(editor => editor.destroy())
    mounts.splice(0).forEach(element => element.remove())
  })

  it('renders the vendored table extension with the project wrapper class', () => {
    const element = document.createElement('div')
    document.body.appendChild(element)
    mounts.push(element)

    const editor = new Editor({
      element,
      extensions: [
        StarterKit,
        TableWithWrapper,
        TableRow,
        TableHeader,
        TableCell,
      ],
      content: {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          {
                            type: 'text',
                            text: 'cell',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    })
    editors.push(editor)

    const html = editor.getHTML()

    expect(html).toContain('class="table-wrapper"')
    expect(html).toContain('<colgroup>')
    expect(element.querySelector('[data-table-node-view="true"]')).not.toBeNull()
  })

  it('parses wrapped table html back into a table node', () => {
    const element = document.createElement('div')
    document.body.appendChild(element)
    mounts.push(element)

    const editor = new Editor({
      element,
      extensions: [
        StarterKit,
        TableWithWrapper,
        TableRow,
        TableHeader,
        TableCell,
      ],
      content: `
        <div class="table-wrapper">
          <table>
            <tbody>
              <tr>
                <td><p>wrapped</p></td>
              </tr>
            </tbody>
          </table>
        </div>
      `,
    })
    editors.push(editor)

    expect(editor.getJSON().content?.[0]?.type).toBe('table')
  })

  it('captures horizontal touch scrolling on the table node view wrapper', () => {
    const element = document.createElement('div')
    document.body.appendChild(element)
    mounts.push(element)

    const editor = new Editor({
      element,
      extensions: [
        StarterKit,
        TableWithWrapper,
        TableRow,
        TableHeader,
        TableCell,
      ],
      content: `
        <div class="table-wrapper">
          <table>
            <tbody>
              <tr>
                <td><p>col-1</p></td>
                <td><p>col-2</p></td>
                <td><p>col-3</p></td>
                <td><p>col-4</p></td>
              </tr>
            </tbody>
          </table>
        </div>
      `,
    })
    editors.push(editor)

    const wrapper = element.querySelector('[data-table-node-view="true"]') as HTMLDivElement | null
    const cell = wrapper?.querySelector('p') as HTMLParagraphElement | null

    expect(wrapper).not.toBeNull()
    expect(cell).not.toBeNull()

    Object.defineProperty(wrapper, 'clientWidth', {
      configurable: true,
      value: 120,
    })
    Object.defineProperty(wrapper, 'scrollWidth', {
      configurable: true,
      value: 320,
    })
    Object.defineProperty(wrapper, 'scrollLeft', {
      configurable: true,
      value: 40,
      writable: true,
    })

    const touchStartEvent = new Event('touchstart', { bubbles: true, cancelable: true })
    Object.defineProperty(touchStartEvent, 'touches', {
      configurable: true,
      value: [{ clientX: 120, clientY: 24 }],
    })
    Object.defineProperty(touchStartEvent, 'changedTouches', {
      configurable: true,
      value: [{ clientX: 120, clientY: 24 }],
    })
    Object.defineProperty(touchStartEvent, 'target', {
      configurable: true,
      value: cell,
    })

    wrapper!.dispatchEvent(touchStartEvent)

    const touchMoveEvent = new Event('touchmove', { bubbles: true, cancelable: true })
    Object.defineProperty(touchMoveEvent, 'touches', {
      configurable: true,
      value: [{ clientX: 70, clientY: 28 }],
    })
    Object.defineProperty(touchMoveEvent, 'changedTouches', {
      configurable: true,
      value: [{ clientX: 70, clientY: 28 }],
    })
    Object.defineProperty(touchMoveEvent, 'target', {
      configurable: true,
      value: cell,
    })
    const stopImmediatePropagation = vi.fn()
    Object.defineProperty(touchMoveEvent, 'stopImmediatePropagation', {
      configurable: true,
      value: stopImmediatePropagation,
    })

    wrapper!.dispatchEvent(touchMoveEvent)

    expect(touchMoveEvent.defaultPrevented).toBe(true)
    expect(stopImmediatePropagation).toHaveBeenCalled()
    expect(wrapper!.scrollLeft).toBe(90)
    expect(wrapper!.classList.contains('is-touch-scrolling')).toBe(true)

    wrapper!.dispatchEvent(new Event('touchend', { bubbles: true }))

    expect(wrapper!.classList.contains('is-touch-scrolling')).toBe(false)
  })
})
