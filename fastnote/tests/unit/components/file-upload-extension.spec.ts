import StarterKit from '@tiptap/starter-kit'
import { Editor } from '@tiptap/vue-3'
import { describe, expect, it } from 'vitest'
import { AttachmentAwareLink } from '@/shared/lib/editor/extensions/FileUpload/AttachmentAwareLink'
import { FileUpload } from '@/shared/lib/editor/extensions/FileUpload/FileUpload'

describe('fileUpload extension semantic HTML', () => {
  it('serializes images as img and files as links', () => {
    const editor = new Editor({
      extensions: [StarterKit.configure({ link: false }), AttachmentAwareLink, FileUpload],
      content: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'fileUpload', attrs: { url: 'photo.png', name: 'photo.png', size: 12, type: 'image/png' } },
            { type: 'text', text: ' ' },
            { type: 'fileUpload', attrs: { url: 'document.pdf', name: 'document.pdf', size: 34, type: 'application/pdf' } },
          ],
        }],
      },
    })

    const html = editor.getHTML()
    expect(html).toContain('<img data-file-name="photo.png"')
    expect(html).toContain('data-note-attachment="image"')
    expect(html).toContain('src="photo.png"')
    expect(html).toContain('<a data-file-name="document.pdf"')
    expect(html).toContain('data-note-attachment="file"')
    expect(html).toContain('href="document.pdf"')
    expect(html).not.toContain('<file-upload')
    editor.destroy()
  })

  it('parses semantic attachments into fileUpload nodes', () => {
    const editor = new Editor({
      extensions: [StarterKit.configure({ link: false }), AttachmentAwareLink, FileUpload],
      content: `
        <p>
          <img data-note-attachment="image" data-file-type="image/png" data-file-name="photo.png" src="photo.png">
          <a data-note-attachment="file" data-file-type="application/pdf" data-file-name="document.pdf" data-file-size="42" href="document.pdf">document.pdf</a>
        </p>
      `,
    })

    const attachments = editor.getJSON().content?.[0]?.content?.filter(node => node.type === 'fileUpload') || []
    expect(attachments).toHaveLength(2)
    expect(attachments[0].attrs).toMatchObject({ name: 'photo.png', type: 'image/png', url: 'photo.png' })
    expect(attachments[1].attrs).toMatchObject({ name: 'document.pdf', size: 42, type: 'application/pdf', url: 'document.pdf' })
    expect(editor.getHTML()).not.toContain('<file-upload')
    editor.destroy()
  })
})
