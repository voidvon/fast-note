import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FileUploadComponent from '@/shared/lib/editor/extensions/FileUpload/FileUploadComponent.vue'

function mountAttachment(
  attrs: Record<string, unknown>,
  loadFile: (url: string, options?: { force?: boolean }) => Promise<{ url: string, type: string }>,
) {
  return mount(FileUploadComponent, {
    props: {
      editor: {
        extensionManager: {
          extensions: [{ name: 'fileUpload', options: { loadFile } }],
        },
      },
      getPos: () => 0,
      node: { attrs },
    },
    global: {
      provide: {
        openPhotoSwipe: vi.fn(),
      },
      stubs: {
        NodeViewWrapper: {
          template: '<div><slot /></div>',
        },
      },
    },
  })
}

describe('file upload component lazy loading', () => {
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    vi.stubGlobal('URL', {
      ...URL,
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('downloads a remote non-image attachment only after the user clicks it', async () => {
    const loadFile = vi.fn(async () => ({ url: 'blob:cached-pdf', type: 'application/pdf' }))
    const wrapper = mountAttachment({
      name: '说明.pdf',
      type: 'application/pdf',
      url: 'remote_random.pdf',
    }, loadFile)

    await flushPromises()
    expect(loadFile).not.toHaveBeenCalled()

    await wrapper.get('.file-preview').trigger('click')
    await flushPromises()

    expect(loadFile).toHaveBeenCalledOnce()
    expect(loadFile).toHaveBeenCalledWith('remote_random.pdf', { force: true })
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('loads a remote image as soon as the attachment node is mounted', async () => {
    const loadFile = vi.fn(async () => ({ url: 'blob:cached-image', type: 'image/png' }))
    const wrapper = mountAttachment({
      name: '图片.png',
      type: 'image/png',
      url: 'remote_random.png',
    }, loadFile)

    await flushPromises()

    expect(loadFile).toHaveBeenCalledOnce()
    expect(loadFile).toHaveBeenCalledWith('remote_random.png', {})
    wrapper.unmount()
  })
})
