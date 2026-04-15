import { mergeAttributes, Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import FileUploadComponent from './FileUploadComponent.vue'

export interface FileUploadOptions {
  HTMLAttributes: Record<string, any>
  loadFile?: (url: string) => Promise<{ url: string, type: string }>
  onImageLoaded?: (url: string, width: number, height: number) => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileUpload: {
      setFileUpload: (attributes: { url?: string, id?: number, type?: string }) => ReturnType
    }
  }
}

export const FileUpload = Node.create<FileUploadOptions>({
  name: 'fileUpload',

  group: 'inline',
  inline: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      loadFile: async (url: string) => {
        return { url, type: 'unknown' }
      },
      onImageLoaded: (_url: string, _width: number, _height: number) => {
        // 默认实现是空的，由YYEditor提供具体实现
      },
    }
  },

  addAttributes() {
    return {
      url: {
        default: null,
      },
      id: {
        default: null,
      },
      type: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'file-upload',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['file-upload', mergeAttributes(HTMLAttributes)]
  },

  addCommands() {
    return {
      setFileUpload:
        attributes => ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(FileUploadComponent as any, {
      // 阻止点击时聚焦编辑器
      stopEvent: ({ event }) => {
        // 阻止所有点击事件冒泡到编辑器
        if (event.type === 'mousedown' || event.type === 'click') {
          return true
        }
        return false
      },
    })
  },
})
