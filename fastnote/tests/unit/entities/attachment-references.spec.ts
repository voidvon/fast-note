import { describe, expect, it } from 'vitest'
import { extractAttachmentReferences, isAttachmentHash } from '@/entities/attachment'

describe('attachment references', () => {
  it('extracts semantic attachments and normalizes remote URLs', () => {
    const hash = 'a'.repeat(64)
    const result = extractAttachmentReferences(`
      <p>before</p>
      <img data-note-attachment="image" data-file-type="image/png" src="${hash}">
      <a data-note-attachment="file" href="/api/files/notes/note-1/remote_document.pdf">PDF</a>
      <a data-note-attachment="file" href="https://example.com/api/files/notes/note-1/remote_document.pdf">PDF</a>
      <a href="https://example.com/not-an-attachment.pdf">普通链接</a>
    `)

    expect(result).toEqual({
      hashes: [hash],
      remoteFilenames: ['remote_document.pdf'],
    })
  })

  it('does not treat arbitrary 64-character text as a hash', () => {
    expect(isAttachmentHash('z'.repeat(64))).toBe(false)
  })
})
