export const MIME_TYPES = {
  IMAGE: {
    JPEG: 'image/jpeg',
    PNG: 'image/png',
    GIF: 'image/gif',
    WEBP: 'image/webp',
    SVG: 'image/svg+xml',
    BMP: 'image/bmp',
    ICO: 'image/x-icon',
    TIFF: 'image/tiff',
  },
  DOCUMENT: {
    PDF: 'application/pdf',
    DOC: 'application/msword',
    DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    XLS: 'application/vnd.ms-excel',
    XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    PPT: 'application/vnd.ms-powerpoint',
    PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    RTF: 'application/rtf',
    TXT: 'text/plain',
    CSV: 'text/csv',
  },
  AUDIO: {
    MP3: 'audio/mpeg',
    WAV: 'audio/wav',
    OGG: 'audio/ogg',
    AAC: 'audio/aac',
    FLAC: 'audio/flac',
    M4A: 'audio/mp4',
  },
  VIDEO: {
    MP4: 'video/mp4',
    AVI: 'video/x-msvideo',
    MOV: 'video/quicktime',
    WMV: 'video/x-ms-wmv',
    FLV: 'video/x-flv',
    WEBM: 'video/webm',
    MKV: 'video/x-matroska',
  },
  ARCHIVE: {
    ZIP: 'application/zip',
    RAR: 'application/vnd.rar',
    TAR: 'application/x-tar',
    GZIP: 'application/gzip',
    SEVEN_ZIP: 'application/x-7z-compressed',
  },
  OTHER: {
    JSON: 'application/json',
    XML: 'application/xml',
    HTML: 'text/html',
    CSS: 'text/css',
    JS: 'application/javascript',
    PSD: 'image/vnd.adobe.photoshop',
  },
} as const

export enum FileCategory {
  IMAGE = 'image',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  VIDEO = 'video',
  ARCHIVE = 'archive',
  OTHER = 'other',
}

const MIME_TO_CATEGORY_MAP = new Map<string, FileCategory>([
  ...Object.values(MIME_TYPES.IMAGE).map(mime => [mime, FileCategory.IMAGE] as const),
  ...Object.values(MIME_TYPES.DOCUMENT).map(mime => [mime, FileCategory.DOCUMENT] as const),
  ...Object.values(MIME_TYPES.AUDIO).map(mime => [mime, FileCategory.AUDIO] as const),
  ...Object.values(MIME_TYPES.VIDEO).map(mime => [mime, FileCategory.VIDEO] as const),
  ...Object.values(MIME_TYPES.ARCHIVE).map(mime => [mime, FileCategory.ARCHIVE] as const),
])

const EXTENSION_TO_MIME_MAP = new Map<string, string>([
  ['jpg', MIME_TYPES.IMAGE.JPEG],
  ['jpeg', MIME_TYPES.IMAGE.JPEG],
  ['png', MIME_TYPES.IMAGE.PNG],
  ['gif', MIME_TYPES.IMAGE.GIF],
  ['webp', MIME_TYPES.IMAGE.WEBP],
  ['svg', MIME_TYPES.IMAGE.SVG],
  ['bmp', MIME_TYPES.IMAGE.BMP],
  ['ico', MIME_TYPES.IMAGE.ICO],
  ['tiff', MIME_TYPES.IMAGE.TIFF],
  ['tif', MIME_TYPES.IMAGE.TIFF],
  ['pdf', MIME_TYPES.DOCUMENT.PDF],
  ['doc', MIME_TYPES.DOCUMENT.DOC],
  ['docx', MIME_TYPES.DOCUMENT.DOCX],
  ['xls', MIME_TYPES.DOCUMENT.XLS],
  ['xlsx', MIME_TYPES.DOCUMENT.XLSX],
  ['ppt', MIME_TYPES.DOCUMENT.PPT],
  ['pptx', MIME_TYPES.DOCUMENT.PPTX],
  ['rtf', MIME_TYPES.DOCUMENT.RTF],
  ['txt', MIME_TYPES.DOCUMENT.TXT],
  ['csv', MIME_TYPES.DOCUMENT.CSV],
  ['mp3', MIME_TYPES.AUDIO.MP3],
  ['wav', MIME_TYPES.AUDIO.WAV],
  ['ogg', MIME_TYPES.AUDIO.OGG],
  ['aac', MIME_TYPES.AUDIO.AAC],
  ['flac', MIME_TYPES.AUDIO.FLAC],
  ['m4a', MIME_TYPES.AUDIO.M4A],
  ['mp4', MIME_TYPES.VIDEO.MP4],
  ['avi', MIME_TYPES.VIDEO.AVI],
  ['mov', MIME_TYPES.VIDEO.MOV],
  ['wmv', MIME_TYPES.VIDEO.WMV],
  ['flv', MIME_TYPES.VIDEO.FLV],
  ['webm', MIME_TYPES.VIDEO.WEBM],
  ['mkv', MIME_TYPES.VIDEO.MKV],
  ['zip', MIME_TYPES.ARCHIVE.ZIP],
  ['rar', MIME_TYPES.ARCHIVE.RAR],
  ['tar', MIME_TYPES.ARCHIVE.TAR],
  ['gz', MIME_TYPES.ARCHIVE.GZIP],
  ['7z', MIME_TYPES.ARCHIVE.SEVEN_ZIP],
  ['json', MIME_TYPES.OTHER.JSON],
  ['xml', MIME_TYPES.OTHER.XML],
  ['html', MIME_TYPES.OTHER.HTML],
  ['css', MIME_TYPES.OTHER.CSS],
  ['js', MIME_TYPES.OTHER.JS],
  ['psd', MIME_TYPES.OTHER.PSD],
])

export function getFileCategoryByMimeType(mimeType: string): FileCategory {
  return MIME_TO_CATEGORY_MAP.get(mimeType) || FileCategory.OTHER
}

export function getMimeTypeByExtension(extension: string): string | undefined {
  return EXTENSION_TO_MIME_MAP.get(extension.toLowerCase())
}

export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.')
  return lastDotIndex > 0 ? filename.slice(lastDotIndex + 1).toLowerCase() : ''
}

export function getMimeTypeByFilename(filename: string): string | undefined {
  const extension = getFileExtension(filename)
  return getMimeTypeByExtension(extension)
}

export function getFileCategoryByFilename(filename: string): FileCategory {
  const mimeType = getMimeTypeByFilename(filename)
  return mimeType ? getFileCategoryByMimeType(mimeType) : FileCategory.OTHER
}

export function isImageFile(file: File | string): boolean {
  const mimeType = typeof file === 'string'
    ? getMimeTypeByFilename(file)
    : file.type

  return mimeType ? getFileCategoryByMimeType(mimeType) === FileCategory.IMAGE : false
}

export function isDocumentFile(file: File | string): boolean {
  const mimeType = typeof file === 'string'
    ? getMimeTypeByFilename(file)
    : file.type

  return mimeType ? getFileCategoryByMimeType(mimeType) === FileCategory.DOCUMENT : false
}

export function isAudioFile(file: File | string): boolean {
  const mimeType = typeof file === 'string'
    ? getMimeTypeByFilename(file)
    : file.type

  return mimeType ? getFileCategoryByMimeType(mimeType) === FileCategory.AUDIO : false
}

export function isVideoFile(file: File | string): boolean {
  const mimeType = typeof file === 'string'
    ? getMimeTypeByFilename(file)
    : file.type

  return mimeType ? getFileCategoryByMimeType(mimeType) === FileCategory.VIDEO : false
}

export function isArchiveFile(file: File | string): boolean {
  const mimeType = typeof file === 'string'
    ? getMimeTypeByFilename(file)
    : file.type

  return mimeType ? getFileCategoryByMimeType(mimeType) === FileCategory.ARCHIVE : false
}

export function getFileIcon(file: File | string): string {
  const category = typeof file === 'string'
    ? getFileCategoryByFilename(file)
    : getFileCategoryByMimeType(file.type)

  switch (category) {
    case FileCategory.IMAGE:
      return 'picture'
    case FileCategory.DOCUMENT: {
      const mimeType = typeof file === 'string'
        ? getMimeTypeByFilename(file)
        : file.type

      if (mimeType === MIME_TYPES.DOCUMENT.PDF)
        return 'pdf'
      if (mimeType === MIME_TYPES.DOCUMENT.DOC || mimeType === MIME_TYPES.DOCUMENT.DOCX)
        return 'doc'
      if (mimeType === MIME_TYPES.DOCUMENT.XLS || mimeType === MIME_TYPES.DOCUMENT.XLSX)
        return 'excel'
      if (mimeType === MIME_TYPES.DOCUMENT.PPT || mimeType === MIME_TYPES.DOCUMENT.PPTX)
        return 'ppt'
      if (mimeType === MIME_TYPES.DOCUMENT.RTF)
        return 'rtf'
      if (mimeType === MIME_TYPES.DOCUMENT.TXT)
        return 'txt'
      return 'doc'
    }
    case FileCategory.AUDIO:
      return 'audio'
    case FileCategory.VIDEO:
      return 'video'
    case FileCategory.ARCHIVE:
      return 'zip'
    default: {
      const specificMimeType = typeof file === 'string'
        ? getMimeTypeByFilename(file)
        : file.type

      if (specificMimeType === MIME_TYPES.OTHER.PSD)
        return 'psd'
      return 'unknown'
    }
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0)
    return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

export function isFileTypeAllowed(file: File, allowedTypes: string[]): boolean {
  const mimeType = file.type
  const extension = getFileExtension(file.name)

  return allowedTypes.some((type) => {
    if (type.includes('/')) {
      return mimeType === type || mimeType.startsWith(type.replace('*', ''))
    }

    return extension === type.replace('.', '').toLowerCase()
  })
}

export function createAcceptString(categories: FileCategory[]): string {
  const mimeTypes: string[] = []

  categories.forEach((category) => {
    switch (category) {
      case FileCategory.IMAGE:
        mimeTypes.push(...Object.values(MIME_TYPES.IMAGE))
        break
      case FileCategory.DOCUMENT:
        mimeTypes.push(...Object.values(MIME_TYPES.DOCUMENT))
        break
      case FileCategory.AUDIO:
        mimeTypes.push(...Object.values(MIME_TYPES.AUDIO))
        break
      case FileCategory.VIDEO:
        mimeTypes.push(...Object.values(MIME_TYPES.VIDEO))
        break
      case FileCategory.ARCHIVE:
        mimeTypes.push(...Object.values(MIME_TYPES.ARCHIVE))
        break
    }
  })

  return mimeTypes.join(',')
}
