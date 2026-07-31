export const ATTACHMENT_KIND_ATTRIBUTE = 'data-note-attachment'
export const ATTACHMENT_TYPE_ATTRIBUTE = 'data-file-type'
export const ATTACHMENT_NAME_ATTRIBUTE = 'data-file-name'
export const ATTACHMENT_SIZE_ATTRIBUTE = 'data-file-size'

export const ATTACHMENT_SELECTOR = [
  `img[${ATTACHMENT_KIND_ATTRIBUTE}="image"][src]`,
  `a[${ATTACHMENT_KIND_ATTRIBUTE}="file"][href]`,
].join(',')

export function isImageAttachmentType(type?: string | null) {
  return !!type && type.toLowerCase().startsWith('image/')
}

export function getAttachmentElementUrl(element: Element) {
  if (element.matches('img'))
    return element.getAttribute('src')?.trim() || ''
  if (element.matches('a'))
    return element.getAttribute('href')?.trim() || ''
  return ''
}

export function setAttachmentElementUrl(element: Element, value: string) {
  if (element.matches('img'))
    element.setAttribute('src', value)
  else if (element.matches('a'))
    element.setAttribute('href', value)
}

export function replaceAttachmentUrls(content: string, replacements: ReadonlyMap<string, string>) {
  if (!content || replacements.size === 0)
    return content
  if (typeof DOMParser === 'undefined')
    throw new TypeError('当前环境不支持 HTML 附件引用转换')

  const document = new DOMParser().parseFromString(content, 'text/html')
  let changed = false
  document.querySelectorAll(ATTACHMENT_SELECTOR).forEach((element) => {
    const current = getAttachmentElementUrl(element)
    const replacement = replacements.get(current)
    if (!replacement || replacement === current)
      return
    setAttachmentElementUrl(element, replacement)
    changed = true
  })

  return changed ? document.body.innerHTML : content
}

export function getRemoteAttachmentFilename(value: string) {
  const trimmed = value.trim()
  if (!trimmed)
    return ''

  try {
    const pathname = new URL(trimmed, 'https://fastnote.invalid').pathname
    const filename = pathname.split('/').filter(Boolean).at(-1) || ''
    return decodeURIComponent(filename)
  }
  catch {
    return trimmed
  }
}

export function buildNoteFileUrl(noteId: string, filename: string) {
  return `/api/files/notes/${encodeURIComponent(noteId)}/${encodeURIComponent(filename)}`
}
