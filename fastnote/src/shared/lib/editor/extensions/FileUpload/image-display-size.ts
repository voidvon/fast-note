export interface ImageDisplaySize {
  width: number
  height: number
}

export const DEFAULT_IMAGE_DISPLAY_SIZE = 88
export const MAX_IMAGE_DISPLAY_SIZE = 208

export function getImageDisplaySize(naturalWidth: number, naturalHeight: number): ImageDisplaySize | null {
  if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight)
    || naturalWidth <= 0 || naturalHeight <= 0) {
    return null
  }

  const aspectRatio = naturalWidth / naturalHeight
  let height = DEFAULT_IMAGE_DISPLAY_SIZE
  let width = height * aspectRatio

  if (width > MAX_IMAGE_DISPLAY_SIZE) {
    width = MAX_IMAGE_DISPLAY_SIZE
    height = width / aspectRatio
  }
  else {
    width = DEFAULT_IMAGE_DISPLAY_SIZE
    height = width / aspectRatio
    if (height > MAX_IMAGE_DISPLAY_SIZE) {
      height = MAX_IMAGE_DISPLAY_SIZE
      width = height * aspectRatio
    }
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  }
}

export function getStoredImageDisplaySize(width?: number | null, height?: number | null): ImageDisplaySize | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !width || !height || width <= 0 || height <= 0)
    return null

  return { width, height }
}
