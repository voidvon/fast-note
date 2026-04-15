export async function copyText(text: string) {
  const content = text.trim()
  if (!content) {
    return false
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content)
    return true
  }

  if (typeof document === 'undefined') {
    throw new TypeError('当前环境不支持复制')
  }

  const textarea = document.createElement('textarea')
  textarea.value = content
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'

  document.body.appendChild(textarea)
  textarea.select()

  try {
    const copied = document.execCommand('copy')
    if (!copied) {
      throw new TypeError('复制失败')
    }

    return true
  }
  finally {
    document.body.removeChild(textarea)
  }
}
