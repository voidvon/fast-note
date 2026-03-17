/* eslint-disable import/consistent-type-specifier-style, perfectionist/sort-imports, perfectionist/sort-named-imports, style/arrow-parens, style/indent, style/quote-props, ts/ban-ts-comment */
import '../types'

import {
  type JSONContent,
  type MarkdownToken,
  callOrReturn,
  getExtensionField,
  mergeAttributes,
  Node,
} from '@tiptap/core'
import type { DOMOutputSpec, Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  CellSelection,
  columnResizing,
  deleteColumn,
  deleteRow,
  deleteTable,
  fixTables,
  goToNextCell,
  mergeCells,
  setCellAttr,
  splitCell,
  tableEditing,
  toggleHeader,
  toggleHeaderCell,
} from '@tiptap/pm/tables'
import type { EditorView, NodeView } from '@tiptap/pm/view'

import { createTableView, DEFAULT_TABLE_WRAPPER_CLASS, TableView } from './TableView'
import { createColGroup } from './utilities/createColGroup'
import { createTable } from './utilities/createTable'
import { deleteTableWhenAllCellsSelected } from './utilities/deleteTableWhenAllCellsSelected'
import renderTableToMarkdown from './utilities/markdown'

type MarkdownTableToken = {
  header?: { tokens: MarkdownToken[] }[]
  rows?: { tokens: MarkdownToken[] }[][]
} & MarkdownToken

export interface TableOptions {
  HTMLAttributes: Record<string, any>
  resizable: boolean
  renderWrapper: boolean
  wrapperClass: string
  handleWidth: number
  cellMinWidth: number
  View: (new (node: ProseMirrorNode, cellMinWidth: number, view: EditorView) => NodeView) | null
  lastColumnResizable: boolean
  allowTableNodeSelection: boolean
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    table: {
      insertTable: (options?: { rows?: number, cols?: number, withHeaderRow?: boolean }) => ReturnType
      addColumnBefore: () => ReturnType
      addColumnAfter: () => ReturnType
      deleteColumn: () => ReturnType
      addRowBefore: () => ReturnType
      addRowAfter: () => ReturnType
      deleteRow: () => ReturnType
      deleteTable: () => ReturnType
      mergeCells: () => ReturnType
      splitCell: () => ReturnType
      toggleHeaderColumn: () => ReturnType
      toggleHeaderRow: () => ReturnType
      toggleHeaderCell: () => ReturnType
      mergeOrSplit: () => ReturnType
      setCellAttribute: (name: string, value: any) => ReturnType
      goToNextCell: () => ReturnType
      goToPreviousCell: () => ReturnType
      fixTables: () => ReturnType
      setCellSelection: (position: { anchorCell: number, headCell?: number }) => ReturnType
    }
  }
}

export const Table = Node.create<TableOptions>({
  name: 'table',

  // @ts-ignore
  addOptions() {
    return {
      HTMLAttributes: {},
      resizable: false,
      renderWrapper: false,
      wrapperClass: DEFAULT_TABLE_WRAPPER_CLASS,
      handleWidth: 5,
      cellMinWidth: 25,
      View: TableView,
      lastColumnResizable: true,
      allowTableNodeSelection: false,
    }
  },

  content: 'tableRow+',

  tableRole: 'table',

  isolating: true,

  group: 'block',

  parseHTML() {
    return [
      { tag: 'table' },
      {
        tag: `div.${this.options.wrapperClass}`,
        skip: true,
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const { colgroup, tableWidth, tableMinWidth } = createColGroup(node, this.options.cellMinWidth)
    const userStyles = HTMLAttributes.style as string | undefined

    function getTableStyle() {
      if (userStyles) {
        return userStyles
      }

      return tableWidth ? `width: ${tableWidth}` : `min-width: ${tableMinWidth}`
    }

    const table: DOMOutputSpec = [
      'table',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        style: getTableStyle(),
      }),
      colgroup,
      ['tbody', 0],
    ]

    return this.options.renderWrapper ? ['div', { class: this.options.wrapperClass }, table] : table
  },

  parseMarkdown: (token: MarkdownTableToken, h) => {
    const rows = []

    if (token.header) {
      const headerCells: JSONContent[] = []

      token.header.forEach(cell => {
        headerCells.push(h.createNode('tableHeader', {}, [{ type: 'paragraph', content: h.parseInline(cell.tokens) }]))
      })

      rows.push(h.createNode('tableRow', {}, headerCells))
    }

    if (token.rows) {
      token.rows.forEach(row => {
        const bodyCells: JSONContent[] = []

        row.forEach(cell => {
          bodyCells.push(h.createNode('tableCell', {}, [{ type: 'paragraph', content: h.parseInline(cell.tokens) }]))
        })

        rows.push(h.createNode('tableRow', {}, bodyCells))
      })
    }

    return h.createNode('table', undefined, rows)
  },

  renderMarkdown: (node, h) => {
    return renderTableToMarkdown(node, h)
  },

  addCommands() {
    return {
      insertTable:
        ({ rows = 3, cols = 3, withHeaderRow = true } = {}) =>
        ({ tr, dispatch, editor }) => {
          const node = createTable(editor.schema, rows, cols, withHeaderRow)

          if (dispatch) {
            const offset = tr.selection.from + 1

            tr.replaceSelectionWith(node)
              .scrollIntoView()
              .setSelection(TextSelection.near(tr.doc.resolve(offset)))
          }

          return true
        },
      addColumnBefore:
        () =>
        ({ state, dispatch }) => addColumnBefore(state, dispatch),
      addColumnAfter:
        () =>
        ({ state, dispatch }) => addColumnAfter(state, dispatch),
      deleteColumn:
        () =>
        ({ state, dispatch }) => deleteColumn(state, dispatch),
      addRowBefore:
        () =>
        ({ state, dispatch }) => addRowBefore(state, dispatch),
      addRowAfter:
        () =>
        ({ state, dispatch }) => addRowAfter(state, dispatch),
      deleteRow:
        () =>
        ({ state, dispatch }) => deleteRow(state, dispatch),
      deleteTable:
        () =>
        ({ state, dispatch }) => deleteTable(state, dispatch),
      mergeCells:
        () =>
        ({ state, dispatch }) => mergeCells(state, dispatch),
      splitCell:
        () =>
        ({ state, dispatch }) => splitCell(state, dispatch),
      toggleHeaderColumn:
        () =>
        ({ state, dispatch }) => toggleHeader('column')(state, dispatch),
      toggleHeaderRow:
        () =>
        ({ state, dispatch }) => toggleHeader('row')(state, dispatch),
      toggleHeaderCell:
        () =>
        ({ state, dispatch }) => toggleHeaderCell(state, dispatch),
      mergeOrSplit:
        () =>
        ({ state, dispatch }) => {
          if (mergeCells(state, dispatch)) {
            return true
          }

          return splitCell(state, dispatch)
        },
      setCellAttribute:
        (name, value) =>
        ({ state, dispatch }) => setCellAttr(name, value)(state, dispatch),
      goToNextCell:
        () =>
        ({ state, dispatch }) => goToNextCell(1)(state, dispatch),
      goToPreviousCell:
        () =>
        ({ state, dispatch }) => goToNextCell(-1)(state, dispatch),
      fixTables:
        () =>
        ({ state, dispatch }) => {
          if (dispatch) {
            fixTables(state)
          }

          return true
        },
      setCellSelection:
        position =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            const selection = CellSelection.create(tr.doc, position.anchorCell, position.headCell)
            tr.setSelection(selection)
          }

          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.commands.goToNextCell()) {
          return true
        }

        if (!this.editor.can().addRowAfter()) {
          return false
        }

        return this.editor.chain().addRowAfter().goToNextCell().run()
      },
      'Shift-Tab': () => this.editor.commands.goToPreviousCell(),
      Backspace: deleteTableWhenAllCellsSelected,
      'Mod-Backspace': deleteTableWhenAllCellsSelected,
      Delete: deleteTableWhenAllCellsSelected,
      'Mod-Delete': deleteTableWhenAllCellsSelected,
    }
  },

  addProseMirrorPlugins() {
    const isResizable = this.options.resizable && this.editor.isEditable
    const viewClass = this.options.View ?? createTableView(this.options.wrapperClass)

    return [
      ...(isResizable
        ? [
            columnResizing({
              handleWidth: this.options.handleWidth,
              cellMinWidth: this.options.cellMinWidth,
              defaultCellMinWidth: this.options.cellMinWidth,
              View: viewClass,
              lastColumnResizable: this.options.lastColumnResizable,
            }),
          ]
        : []),
      tableEditing({
        allowTableNodeSelection: this.options.allowTableNodeSelection,
      }),
    ]
  },

  extendNodeSchema(extension) {
    const context = {
      name: extension.name,
      options: extension.options,
      storage: extension.storage,
    }

    return {
      tableRole: callOrReturn(getExtensionField(extension, 'tableRole', context)),
    }
  },
})
