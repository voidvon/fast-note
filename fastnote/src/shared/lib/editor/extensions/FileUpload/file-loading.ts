import { FileCategory, getFileCategoryByMimeType, isImageFile } from '@/shared/lib/mime-types'

export interface AttachmentNodeAttributes {
  url?: string | null
  name?: string | null
  type?: string | null
}

export function isLocalAttachmentHash(value?: string | null): boolean {
  return !!value && /^[a-f0-9]{64}$/i.test(value)
}

export function getAttachmentDisplayName(attributes: AttachmentNodeAttributes): string {
  return attributes.name?.trim() || attributes.url?.trim() || '附件'
}

export function isLikelyImageAttachment(attributes: AttachmentNodeAttributes): boolean {
  if (attributes.type && getFileCategoryByMimeType(attributes.type) === FileCategory.IMAGE)
    return true

  const filename = attributes.name || attributes.url
  return filename ? isImageFile(filename) : false
}

export function shouldAutoLoadAttachment(attributes: AttachmentNodeAttributes): boolean {
  return isLocalAttachmentHash(attributes.url) || isLikelyImageAttachment(attributes)
}
