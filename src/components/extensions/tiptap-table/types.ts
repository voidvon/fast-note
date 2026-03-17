import type { ParentConfig } from '@tiptap/core'

declare module '@tiptap/core' {
  interface NodeConfig<Options, Storage> {
    /**
     * The semantic role used by table-related nodes.
     */
    tableRole?:
      | string
      | ((this: {
          name: string
          options: Options
          storage: Storage
          parent: ParentConfig<NodeConfig<Options>>['tableRole']
        }) => string)
  }
}
