import { describe, expect, it } from 'vitest'
import { getImageDisplaySize, getStoredImageDisplaySize } from '@/shared/lib/editor/extensions/FileUpload/image-display-size'

describe('image display size', () => {
  it('fits image dimensions into the attachment preview bounds', () => {
    expect(getImageDisplaySize(100, 100)).toEqual({ width: 88, height: 88 })
    expect(getImageDisplaySize(400, 100)).toEqual({ width: 208, height: 52 })
    expect(getImageDisplaySize(100, 400)).toEqual({ width: 52, height: 208 })
  })

  it('rejects invalid image and stored dimensions', () => {
    expect(getImageDisplaySize(0, 100)).toBeNull()
    expect(getStoredImageDisplaySize(0, 88)).toBeNull()
    expect(getStoredImageDisplaySize(88, 176)).toEqual({ width: 88, height: 176 })
  })
})
