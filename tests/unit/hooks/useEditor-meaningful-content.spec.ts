import { describe, expect, it, vi } from 'vitest'
import { applyDefaultHeadingIfEmptyToEditor, DEFAULT_NEW_NOTE_HEADING_CONTENT, hasMeaningfulEditorContent } from '@/hooks/useEditor'

describe('useEditor meaningful content helpers (t-fn-045 / t-fn-047, tc-fn-038, tc-fn-040)', () => {
  it('applies the default heading only once for an empty editor document', () => {
    let currentDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
        },
      ],
    }

    const setContentMock = vi.fn((nextDoc) => {
      currentDoc = JSON.parse(JSON.stringify(nextDoc))
    })

    const editor = {
      getJSON: () => currentDoc,
      commands: {
        setContent: setContentMock,
      },
    }

    expect(applyDefaultHeadingIfEmptyToEditor(editor)).toBe(true)
    expect(currentDoc).toEqual(DEFAULT_NEW_NOTE_HEADING_CONTENT)
    expect(applyDefaultHeadingIfEmptyToEditor(editor)).toBe(false)
    expect(setContentMock).toHaveBeenCalledTimes(1)
  })

  it('detects empty and meaningful rich-text content correctly', () => {
    expect(hasMeaningfulEditorContent({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
        },
      ],
    })).toBe(false)

    expect(hasMeaningfulEditorContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
        },
      ],
    })).toBe(false)

    expect(hasMeaningfulEditorContent({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [
            {
              type: 'text',
              text: '一级标题',
            },
          ],
        },
      ],
    })).toBe(true)

    expect(hasMeaningfulEditorContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'fileUpload',
              attrs: { url: 'hash' },
            },
          ],
        },
      ],
    })).toBe(true)

    expect(hasMeaningfulEditorContent({
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
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })).toBe(true)
  })
})
