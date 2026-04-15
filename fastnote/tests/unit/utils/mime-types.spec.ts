import { describe, expect, it } from 'vitest'
import {
  FileCategory,
  formatFileSize,
  getFileCategoryByFilename,
  getFileExtension,
  getMimeTypeByFilename,
  isFileTypeAllowed,
} from '@/shared/lib/mime-types'
import { createMockFile } from '../../setup/test-env'

describe('mimeTypes utils', () => {
  it('parses extension and category from filename', () => {
    expect(getFileExtension('demo.PDF')).toBe('pdf')
    expect(getMimeTypeByFilename('demo.pdf')).toBe('application/pdf')
    expect(getFileCategoryByFilename('demo.pdf')).toBe(FileCategory.DOCUMENT)
  })

  it('formats file size with readable units', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1024 * 1024)).toBe('1 MB')
  })

  it('supports mime and extension allow-list checks', () => {
    const image = createMockFile('cover.png', 'image/png')

    expect(isFileTypeAllowed(image, ['image/*'])).toBe(true)
    expect(isFileTypeAllowed(image, ['.png'])).toBe(true)
    expect(isFileTypeAllowed(image, ['application/pdf'])).toBe(false)
  })
})
