import type { EditorView } from '@tiptap/pm/view'
import { TextSelection } from '@tiptap/pm/state'

type LinkClickEvent = Pick<MouseEvent, 'altKey' | 'button' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'target'>

export function isMacPlatform(platform = globalThis.navigator?.platform || ''): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform)
}

export function hasOpenLinkModifier(
  event: Pick<LinkClickEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
  macPlatform = isMacPlatform(),
): boolean {
  if (event.altKey || event.shiftKey) {
    return false
  }

  return macPlatform
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
}

function findLink(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) {
    return null
  }

  return target.closest('a[href]')
}

export function handleEditableLinkClick(
  view: EditorView,
  position: number,
  event: MouseEvent,
  options: {
    macPlatform?: boolean
    open?: (url: string, target: string) => void
  } = {},
): boolean {
  if (!view.editable || event.button !== 0) {
    return false
  }

  const link = findLink(event.target)
  if (!link) {
    return false
  }

  event.preventDefault()

  if (hasOpenLinkModifier(event, options.macPlatform)) {
    const open = options.open || ((url: string, target: string) => {
      window.open(url, target, 'noopener,noreferrer')
    })
    open(link.href, link.target || '_blank')
    return true
  }

  const resolvedPosition = view.state.doc.resolve(position)
  view.dispatch(view.state.tr.setSelection(TextSelection.near(resolvedPosition)))
  view.focus()
  return true
}
