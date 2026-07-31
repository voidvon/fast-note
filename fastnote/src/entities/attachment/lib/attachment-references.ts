import {
  ATTACHMENT_SELECTOR,
  getAttachmentElementUrl,
  getRemoteAttachmentFilename,
} from '@/shared/lib/editor/extensions/FileUpload/attachment-html'

export interface AttachmentReferences {
  hashes: string[]
  remoteFilenames: string[]
}

export function isAttachmentHash(value: string) {
  return /^[a-f0-9]{64}$/i.test(value)
}

export function extractAttachmentReferences(content?: string | null): AttachmentReferences {
  const values: string[] = []

  if (content) {
    if (typeof DOMParser === 'undefined')
      throw new TypeError('当前环境不支持 HTML 附件引用解析')

    const document = new DOMParser().parseFromString(content, 'text/html')
    document.querySelectorAll(ATTACHMENT_SELECTOR).forEach((node) => {
      const value = getAttachmentElementUrl(node)
      if (value)
        values.push(value)
    })
  }

  const hashes = [...new Set(values.filter(isAttachmentHash))]
  const remoteFilenames = [...new Set(values
    .filter(value => !isAttachmentHash(value))
    .map(getRemoteAttachmentFilename)
    .filter(Boolean))]

  return {
    hashes,
    remoteFilenames,
  }
}
