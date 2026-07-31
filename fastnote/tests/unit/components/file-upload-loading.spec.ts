import { describe, expect, it } from 'vitest'
import {
  getAttachmentDisplayName,
  isLikelyImageAttachment,
  shouldAutoLoadAttachment,
} from '@/shared/lib/editor/extensions/FileUpload/file-loading'

describe('file upload loading policy', () => {
  it('automatically loads remote images for editor rendering', () => {
    expect(shouldAutoLoadAttachment({ url: 'photo_random.png' })).toBe(true)
    expect(isLikelyImageAttachment({ url: 'opaque', type: 'image/webp' })).toBe(true)
  })

  it('does not automatically load non-image remote attachments', () => {
    expect(shouldAutoLoadAttachment({ url: 'document_random.pdf' })).toBe(false)
    expect(shouldAutoLoadAttachment({ url: 'archive_random.zip', type: 'application/zip' })).toBe(false)
  })

  it('loads local hashes to preserve existing unsynced attachment previews', () => {
    expect(shouldAutoLoadAttachment({ url: 'a'.repeat(64) })).toBe(true)
  })

  it('prefers the original filename for display and downloads', () => {
    expect(getAttachmentDisplayName({ name: '产品说明.pdf', url: 'document_random.pdf' })).toBe('产品说明.pdf')
    expect(getAttachmentDisplayName({ url: 'document_random.pdf' })).toBe('document_random.pdf')
  })
})
