export interface AttachmentReferences {
  hashes: string[]
  remoteFilenames: string[]
}

export function isAttachmentHash(value: string) {
  return /^[a-f0-9]{64}$/i.test(value)
}

export function extractAttachmentReferences(content?: string | null): AttachmentReferences {
  const values: string[] = []

  if (content && typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(content, 'text/html')
    document.querySelectorAll('file-upload[url]').forEach((node) => {
      const value = node.getAttribute('url')?.trim()
      if (value)
        values.push(value)
    })
  }
  else if (content) {
    const pattern = /<file-upload[^>]+url=["']([^"']+)["']/gi
    let match = pattern.exec(content)
    while (match) {
      values.push(match[1])
      match = pattern.exec(content)
    }
  }

  const unique = [...new Set(values)]
  return {
    hashes: unique.filter(isAttachmentHash),
    remoteFilenames: unique.filter(value => !isAttachmentHash(value)),
  }
}
