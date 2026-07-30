import { describe, expect, it } from 'vitest'
import { extractAttachmentReferences, isAttachmentHash } from '@/entities/attachment'

describe('attachment references', () => {
  it('extracts and deduplicates local hashes and remote filenames', () => {
    const hash = 'a'.repeat(64)
    const result = extractAttachmentReferences(`
      <p>before</p>
      <file-upload url="${hash}"></file-upload>
      <file-upload url="remote_document.pdf"></file-upload>
      <file-upload url="remote_document.pdf"></file-upload>
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
