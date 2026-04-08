export type ItemType = 'rename' | 'delete' | 'restore' | 'deleteNow' | 'move'

export interface NoteActionMenuItem {
  type: ItemType
}
