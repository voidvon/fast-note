export type ItemType
  = 'rename'
    | 'delete'
    | 'restore'
    | 'deleteNow'
    | 'move'
    | 'createNote'
    | 'createFolder'

export interface NoteActionMenuItem {
  type: ItemType
}
