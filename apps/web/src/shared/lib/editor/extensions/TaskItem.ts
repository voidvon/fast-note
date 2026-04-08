import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { mergeAttributes, Node, renderNestedMarkdownContent, wrappingInputRule } from '@tiptap/core'

export interface TaskItemOptions {
  onReadOnlyChecked?: (node: ProseMirrorNode, checked: boolean) => boolean
  nested: boolean
  HTMLAttributes: Record<string, any>
  taskListTypeName: string
  a11y?: {
    checkboxLabel?: (node: ProseMirrorNode, checked: boolean) => string
  }
}

const inputRegex = /^\s*(\[([( |x])?\])\s$/

export const TaskItem = Node.create<TaskItemOptions>({
  name: 'taskItem',

  addOptions() {
    return {
      nested: false,
      HTMLAttributes: {},
      taskListTypeName: 'taskList',
      a11y: undefined,
    }
  },

  content() {
    return this.options.nested ? 'paragraph block*' : 'paragraph+'
  },

  defining: true,

  addAttributes() {
    return {
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: (element: HTMLElement) => {
          const dataChecked = element.getAttribute('data-checked')
          return dataChecked === '' || dataChecked === 'true'
        },
        renderHTML: (attributes: Record<string, any>) => ({
          'data-checked': attributes.checked,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: `li[data-type="${this.name}"]`,
        priority: 51,
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
      }),
      [
        'label',
        [
          'input',
          {
            type: 'checkbox',
            checked: node.attrs.checked ? 'checked' : null,
          },
        ],
        ['span'],
      ],
      ['div', 0],
    ]
  },

  parseMarkdown: (token, h) => {
    const content = []

    if (token.tokens && token.tokens.length > 0) {
      content.push(h.createNode('paragraph', {}, h.parseInline(token.tokens)))
    }
    else if (token.text) {
      content.push(h.createNode('paragraph', {}, [h.createNode('text', { text: token.text })]))
    }
    else {
      content.push(h.createNode('paragraph', {}, []))
    }

    if (token.nestedTokens && token.nestedTokens.length > 0) {
      const nestedContent = h.parseChildren(token.nestedTokens)
      content.push(...nestedContent)
    }

    return h.createNode('taskItem', { checked: token.checked || false }, content)
  },

  renderMarkdown: (node, h) => {
    const checkedChar = node.attrs?.checked ? 'x' : ' '
    const prefix = `- [${checkedChar}] `

    return renderNestedMarkdownContent(node, h, prefix)
  },

  addKeyboardShortcuts() {
    const shortcuts = {
      'Enter': () => this.editor.commands.splitListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
    }

    if (!this.options.nested) {
      return shortcuts
    }

    return {
      ...shortcuts,
      Tab: () => this.editor.commands.sinkListItem(this.name),
    }
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement('li')
      const checkboxWrapper = document.createElement('label')
      const checkboxStyler = document.createElement('span')
      const checkbox = document.createElement('input')
      const content = document.createElement('div')

      const updateA11Y = (currentNode: ProseMirrorNode) => {
        checkbox.ariaLabel = this.options.a11y?.checkboxLabel?.(currentNode, checkbox.checked)
          || `Task item checkbox for ${currentNode.textContent || 'empty task item'}`
      }

      updateA11Y(node)
      checkboxWrapper.contentEditable = 'false'
      checkbox.type = 'checkbox'
      let suppressNativeClick = false
      let suppressNativeClickTimer: number | null = null

      const applyCheckedState = (checked: boolean) => {
        if (!editor.isEditable && !this.options.onReadOnlyChecked) {
          checkbox.checked = !checkbox.checked
          return false
        }

        if (editor.isEditable && typeof getPos === 'function') {
          const position = getPos()
          if (typeof position !== 'number') {
            return false
          }

          const currentNode = editor.state.doc.nodeAt(position)
          if (!currentNode) {
            return false
          }

          // Preserve the official task-item behavior but avoid forcing editor focus on mobile.
          const transaction = editor.state.tr.setNodeMarkup(position, undefined, {
            ...currentNode.attrs,
            checked,
          })
          editor.view.dispatch(transaction)
          return true
        }

        if (!editor.isEditable && this.options.onReadOnlyChecked) {
          if (!this.options.onReadOnlyChecked(node, checked)) {
            return false
          }
        }

        return true
      }

      const resetClickSuppression = () => {
        suppressNativeClick = false
        if (suppressNativeClickTimer !== null) {
          window.clearTimeout(suppressNativeClickTimer)
          suppressNativeClickTimer = null
        }
      }

      const handlePress = (event: Event) => {
        event.preventDefault()
        event.stopPropagation()

        suppressNativeClick = true
        if (suppressNativeClickTimer !== null) {
          window.clearTimeout(suppressNativeClickTimer)
        }
        suppressNativeClickTimer = window.setTimeout(() => {
          resetClickSuppression()
        }, 400)

        const nextChecked = !checkbox.checked
        const didApply = applyCheckedState(nextChecked)
        checkbox.checked = didApply ? nextChecked : checkbox.checked
      }

      const handleClick = (event: Event) => {
        if (!suppressNativeClick) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        resetClickSuppression()
      }

      if (typeof window !== 'undefined' && 'PointerEvent' in window) {
        checkboxWrapper.addEventListener('pointerdown', handlePress)
      }
      else {
        checkboxWrapper.addEventListener('touchstart', handlePress, { passive: false })
        checkboxWrapper.addEventListener('mousedown', handlePress)
      }
      checkboxWrapper.addEventListener('click', handleClick)

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value)
      })

      listItem.dataset.checked = String(node.attrs.checked)
      checkbox.checked = node.attrs.checked
      checkboxWrapper.append(checkbox, checkboxStyler)
      listItem.append(checkboxWrapper, content)

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value)
      })

      return {
        dom: listItem,
        contentDOM: content,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false
          }

          listItem.dataset.checked = String(updatedNode.attrs.checked)
          checkbox.checked = updatedNode.attrs.checked
          updateA11Y(updatedNode)
          return true
        },
        destroy: () => {
          resetClickSuppression()
        },
      }
    }
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: match => ({
          checked: match[match.length - 1] === 'x',
        }),
      }),
    ]
  },
})
