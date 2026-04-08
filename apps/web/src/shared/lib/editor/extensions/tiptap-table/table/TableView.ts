import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { NodeView, ViewMutationRecord } from '@tiptap/pm/view'

import { getColStyleDeclaration } from './utilities/colStyle'

export const DEFAULT_TABLE_WRAPPER_CLASS = 'table-wrapper'

export function updateColumns(
  node: ProseMirrorNode,
  colgroup: HTMLTableColElement,
  table: HTMLTableElement,
  cellMinWidth: number,
  overrideCol?: number,
  overrideValue?: number,
) {
  let totalWidth = 0
  let fixedWidth = true
  let nextDOM = colgroup.firstChild
  const row = node.firstChild

  if (row !== null) {
    for (let i = 0, col = 0; i < row.childCount; i += 1) {
      const { colspan, colwidth } = row.child(i).attrs

      for (let j = 0; j < colspan; j += 1, col += 1) {
        const hasWidth = overrideCol === col ? overrideValue : ((colwidth && colwidth[j]) as number | undefined)
        const cssWidth = hasWidth ? `${hasWidth}px` : ''

        totalWidth += hasWidth || cellMinWidth

        if (!hasWidth) {
          fixedWidth = false
        }

        if (!nextDOM) {
          const colElement = document.createElement('col')
          const [propertyKey, propertyValue] = getColStyleDeclaration(cellMinWidth, hasWidth)

          colElement.style.setProperty(propertyKey, propertyValue)
          colgroup.appendChild(colElement)
        }
        else {
          if ((nextDOM as HTMLTableColElement).style.width !== cssWidth) {
            const [propertyKey, propertyValue] = getColStyleDeclaration(cellMinWidth, hasWidth)

            ;(nextDOM as HTMLTableColElement).style.setProperty(propertyKey, propertyValue)
          }

          nextDOM = nextDOM.nextSibling
        }
      }
    }
  }

  while (nextDOM) {
    const after = nextDOM.nextSibling
    nextDOM.parentNode?.removeChild(nextDOM)
    nextDOM = after
  }

  const hasUserWidth = node.attrs.style && typeof node.attrs.style === 'string' && /\bwidth\s*:/i.test(node.attrs.style)

  if (fixedWidth && !hasUserWidth) {
    table.style.width = `${totalWidth}px`
    table.style.minWidth = ''
  }
  else {
    table.style.width = ''
    table.style.minWidth = `${totalWidth}px`
  }
}

export function createTableView(wrapperClass = DEFAULT_TABLE_WRAPPER_CLASS) {
  return class TableView implements NodeView {
    static readonly TOUCH_SCROLL_THRESHOLD = 8

    node: ProseMirrorNode

    cellMinWidth: number

    dom: HTMLDivElement

    table: HTMLTableElement

    colgroup: HTMLTableColElement

    contentDOM: HTMLTableSectionElement

    private touchStartX: number | null = null

    private touchStartY: number | null = null

    private touchScrollLeft = 0

    private isHorizontalTouchScroll = false

    private readonly handleTouchStart = (event: TouchEvent) => {
      if (!this.canScrollHorizontally()) {
        this.resetTouchScrollState()
        return
      }

      const touch = this.getPrimaryTouch(event)

      if (!touch) {
        return
      }

      this.touchStartX = touch.clientX
      this.touchStartY = touch.clientY
      this.touchScrollLeft = this.dom.scrollLeft
      this.isHorizontalTouchScroll = false
    }

    private readonly handleTouchMove = (event: TouchEvent) => {
      if (this.touchStartX === null || this.touchStartY === null || !this.canScrollHorizontally()) {
        return
      }

      const touch = this.getPrimaryTouch(event)

      if (!touch) {
        return
      }

      const deltaX = touch.clientX - this.touchStartX
      const deltaY = touch.clientY - this.touchStartY

      if (!this.isHorizontalTouchScroll) {
        const horizontalDistance = Math.abs(deltaX)
        const verticalDistance = Math.abs(deltaY)

        if (
          horizontalDistance < TableView.TOUCH_SCROLL_THRESHOLD
          || horizontalDistance <= verticalDistance
        ) {
          return
        }

        this.isHorizontalTouchScroll = true
        this.dom.classList.add('is-touch-scrolling')
      }

      event.preventDefault()
      event.stopImmediatePropagation?.()
      event.stopPropagation()
      this.dom.scrollLeft = this.touchScrollLeft - deltaX
    }

    private readonly handleTouchEnd = () => {
      this.resetTouchScrollState()
    }

    constructor(node: ProseMirrorNode, cellMinWidth: number) {
      this.node = node
      this.cellMinWidth = cellMinWidth
      this.dom = document.createElement('div')
      this.dom.className = wrapperClass
      this.dom.setAttribute('data-table-node-view', 'true')
      this.table = this.dom.appendChild(document.createElement('table'))

      if (node.attrs.style) {
        this.table.style.cssText = node.attrs.style
      }

      this.colgroup = this.table.appendChild(document.createElement('colgroup'))
      updateColumns(node, this.colgroup, this.table, cellMinWidth)
      this.contentDOM = this.table.appendChild(document.createElement('tbody'))

      this.dom.addEventListener('touchstart', this.handleTouchStart, { passive: true, capture: true })
      this.dom.addEventListener('touchmove', this.handleTouchMove, { passive: false, capture: true })
      this.dom.addEventListener('touchend', this.handleTouchEnd, true)
      this.dom.addEventListener('touchcancel', this.handleTouchEnd, true)
    }

    update(node: ProseMirrorNode) {
      if (node.type !== this.node.type) {
        return false
      }

      this.node = node
      updateColumns(node, this.colgroup, this.table, this.cellMinWidth)

      return true
    }

    ignoreMutation(mutation: ViewMutationRecord) {
      const target = mutation.target as Node
      const isInsideWrapper = this.dom.contains(target)
      const isInsideContent = this.contentDOM.contains(target)

      if (isInsideWrapper && !isInsideContent) {
        return mutation.type === 'attributes' || mutation.type === 'childList' || mutation.type === 'characterData'
      }

      return false
    }

    stopEvent(event: Event) {
      if (!event.type.startsWith('touch')) {
        return false
      }

      return this.isHorizontalTouchScroll
    }

    destroy() {
      this.dom.removeEventListener('touchstart', this.handleTouchStart, true)
      this.dom.removeEventListener('touchmove', this.handleTouchMove, true)
      this.dom.removeEventListener('touchend', this.handleTouchEnd, true)
      this.dom.removeEventListener('touchcancel', this.handleTouchEnd, true)
      this.resetTouchScrollState()
    }

    private getPrimaryTouch(event: TouchEvent) {
      return event.touches[0] || event.changedTouches[0] || null
    }

    private canScrollHorizontally() {
      return this.dom.scrollWidth > this.dom.clientWidth
    }

    private resetTouchScrollState() {
      this.touchStartX = null
      this.touchStartY = null
      this.touchScrollLeft = this.dom.scrollLeft
      this.isHorizontalTouchScroll = false
      this.dom.classList.remove('is-touch-scrolling')
    }
  }
}

export const TableView = createTableView()
