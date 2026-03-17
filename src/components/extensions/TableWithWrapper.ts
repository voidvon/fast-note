import { Table } from '@/components/extensions/tiptap-table'

/**
 * 基于项目内 vendored tiptap table 源码生成的默认表格扩展。
 * 当前保持外层滚动容器，以兼容既有 `.table-wrapper` 样式。
 */
export const TableWithWrapper = Table.configure({
  renderWrapper: true,
  wrapperClass: 'table-wrapper',
})
