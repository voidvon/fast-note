import Link from '@tiptap/extension-link'
import { ATTACHMENT_KIND_ATTRIBUTE } from './attachment-html'

export const AttachmentAwareLink = Link.extend({
  parseHTML() {
    return [{
      tag: `a[href]:not([${ATTACHMENT_KIND_ATTRIBUTE}])`,
      getAttrs: (node: HTMLElement) => {
        const href = node.getAttribute('href')
        if (!href || !this.options.isAllowedUri(href, {
          defaultProtocol: this.options.defaultProtocol,
          defaultValidate: value => Boolean(value),
          protocols: this.options.protocols,
        })) {
          return false
        }
        return null
      },
    }]
  },
})
