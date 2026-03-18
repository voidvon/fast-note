import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'
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
})
