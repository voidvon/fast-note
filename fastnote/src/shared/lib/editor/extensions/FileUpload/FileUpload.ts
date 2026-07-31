import { mergeAttributes, Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import {
  ATTACHMENT_KIND_ATTRIBUTE,
  ATTACHMENT_NAME_ATTRIBUTE,
  ATTACHMENT_SIZE_ATTRIBUTE,
  ATTACHMENT_TYPE_ATTRIBUTE,
  isImageAttachmentType,
} from './attachment-html'
import FileUploadComponent from './FileUploadComponent.vue'

export interface FileUploadOptions {
  HTMLAttributes: Record<string, any>
  loadFile?: (url: string, options?: { force?: boolean }) => Promise<{ url: string, type: string }>
  onImageLoaded?: (url: string, width: number, height: number) => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileUpload: {
      setFileUpload: (attributes: { url?: string, id?: number, name?: string, size?: number, type?: string }) => ReturnType
    }
  }
}

export const FileUpload = Node.create<FileUploadOptions>({
  name: 'fileUpload',

  priority: 1100,

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
        parseHTML: element => element.getAttribute('src') || element.getAttribute('href'),
      },
      id: {
        default: null,
      },
      type: {
        default: null,
        parseHTML: element => element.getAttribute(ATTACHMENT_TYPE_ATTRIBUTE) || element.getAttribute('type'),
      },
      name: {
        default: null,
        parseHTML: element => element.getAttribute(ATTACHMENT_NAME_ATTRIBUTE)
          || element.getAttribute('alt')
          || element.getAttribute('download')
          || element.textContent,
      },
      size: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute(ATTACHMENT_SIZE_ATTRIBUTE)
          if (!value)
            return null
          const size = Number(value)
          return Number.isFinite(size) && size >= 0 ? size : null
        },
      },
    }
  },

  parseHTML() {
    return [
      { tag: `img[${ATTACHMENT_KIND_ATTRIBUTE}="image"]` },
      { tag: `a[${ATTACHMENT_KIND_ATTRIBUTE}="file"]` },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { name, size, type, url } = HTMLAttributes
    const commonAttributes = {
      [ATTACHMENT_NAME_ATTRIBUTE]: name || '',
      [ATTACHMENT_SIZE_ATTRIBUTE]: size || '',
      [ATTACHMENT_TYPE_ATTRIBUTE]: type || '',
    }

    if (isImageAttachmentType(type)) {
      return ['img', mergeAttributes(this.options.HTMLAttributes, commonAttributes, {
        [ATTACHMENT_KIND_ATTRIBUTE]: 'image',
        alt: name || '',
        decoding: 'async',
        loading: 'lazy',
        src: url,
      })]
    }

    return ['a', mergeAttributes(this.options.HTMLAttributes, commonAttributes, {
      [ATTACHMENT_KIND_ATTRIBUTE]: 'file',
      download: name || '',
      href: url,
    }), name || '附件']
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
