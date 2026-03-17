import type { JSONContent, MarkdownRendererHelpers } from '@tiptap/core'

export const DEFAULT_CELL_LINE_SEPARATOR = '\u001F'

function collapseWhitespace(s: string) {
  return (s || '').replace(/\s+/g, ' ').trim()
}

export function renderTableToMarkdown(
  node: JSONContent,
  h: MarkdownRendererHelpers,
  options: { cellLineSeparator?: string } = {},
) {
  const cellSep = options.cellLineSeparator ?? DEFAULT_CELL_LINE_SEPARATOR

  if (!node || !node.content || node.content.length === 0) {
    return ''
  }

  const rows: { text: string; isHeader: boolean }[][] = []

  node.content.forEach(rowNode => {
    const cells: { text: string; isHeader: boolean }[] = []

    if (rowNode.content) {
      rowNode.content.forEach(cellNode => {
        let raw = ''

        if (cellNode.content && Array.isArray(cellNode.content) && cellNode.content.length > 1) {
          const parts = cellNode.content.map(child => h.renderChildren(child as unknown as JSONContent))
          raw = parts.join(cellSep)
        }
        else {
          raw = cellNode.content ? h.renderChildren(cellNode.content as unknown as JSONContent[]) : ''
        }

        cells.push({
          text: collapseWhitespace(raw),
          isHeader: cellNode.type === 'tableHeader',
        })
      })
    }

    rows.push(cells)
  })

  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0)

  if (columnCount === 0) {
    return ''
  }

  const colWidths = new Array(columnCount).fill(0)

  rows.forEach(row => {
    for (let index = 0; index < columnCount; index += 1) {
      const cell = row[index]?.text || ''
      const length = cell.length

      if (length > colWidths[index]) {
        colWidths[index] = length
      }

      if (colWidths[index] < 3) {
        colWidths[index] = 3
      }
    }
  })

  const pad = (text: string, width: number) => text + ' '.repeat(Math.max(0, width - text.length))
  const headerRow = rows[0]
  const hasHeader = headerRow.some(cell => cell.isHeader)
  const headerTexts = new Array(columnCount)
    .fill(0)
    .map((_, index) => (hasHeader ? headerRow[index]?.text || '' : ''))

  let output = '\n'

  output += `| ${headerTexts.map((text, index) => pad(text, colWidths[index])).join(' | ')} |\n`
  output += `| ${colWidths.map(width => '-'.repeat(Math.max(3, width))).join(' | ')} |\n`

  const bodyRows = hasHeader ? rows.slice(1) : rows

  bodyRows.forEach(row => {
    output += `| ${new Array(columnCount)
      .fill(0)
      .map((_, index) => pad(row[index]?.text || '', colWidths[index]))
      .join(' | ')} |\n`
  })

  return output
}

export default renderTableToMarkdown
