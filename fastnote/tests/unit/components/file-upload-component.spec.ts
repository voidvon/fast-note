import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FileUploadComponent from '@/shared/lib/editor/extensions/FileUpload/FileUploadComponent.vue'

function mountAttachment(
  attrs: Record<string, unknown>,
  loadFile: (url: string, options?: { force?: boolean }) => Promise<{ url: string, type: string }>,
  selected = false,
  updateAttributes = vi.fn(),
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
      selected,
      updateAttributes,
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

  it('bottom-aligns adjacent attachment nodes regardless of their internal content', () => {
    const wrapper = mountAttachment({
      name: '说明.pdf',
      type: 'application/pdf',
      url: 'remote_random.pdf',
    }, vi.fn())

    expect(wrapper.get('.file-upload-wrapper').attributes('style')).toContain('vertical-align: bottom')
    wrapper.unmount()
  })

  it('exposes a selected class for the attachment focus ring', () => {
    const wrapper = mountAttachment({
      name: '说明.pdf',
      type: 'application/pdf',
      url: 'remote_random.pdf',
    }, vi.fn(), true)

    expect(wrapper.get('.file-upload-wrapper').classes()).toContain('is-selected')
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

  it('does not render an image with an empty src while the local blob is loading', async () => {
    let resolveFile!: (value: { url: string, type: string }) => void
    const loadFile = vi.fn(() => new Promise<{ url: string, type: string }>((resolve) => {
      resolveFile = resolve
    }))
    const wrapper = mountAttachment({
      name: 'clipboard.png',
      type: 'image/png',
      url: 'a'.repeat(64),
    }, loadFile)

    expect(wrapper.find('.loading-wrapper').exists()).toBe(true)
    expect(wrapper.find('.image-preview img').exists()).toBe(false)

    resolveFile({ url: 'blob:clipboard-image', type: 'image/png' })
    await flushPromises()

    expect(wrapper.find('.loading-wrapper').exists()).toBe(false)
    expect(wrapper.get('.image-preview img').attributes('src')).toBe('blob:clipboard-image')
    expect(wrapper.find('.error-text').exists()).toBe(false)
    wrapper.unmount()
  })

  it('reserves the stored image dimensions while its local blob is loading', () => {
    const wrapper = mountAttachment({
      name: 'portrait.png',
      type: 'image/png',
      url: 'a'.repeat(64),
      width: 52,
      height: 208,
    }, vi.fn(() => new Promise(() => {})))

    expect(wrapper.find('.loading-wrapper').exists()).toBe(true)
    expect(wrapper.get('.file-upload-content').classes()).toEqual(expect.arrayContaining(['relative', 'overflow-hidden']))
    expect(wrapper.get('.file-upload-wrapper').attributes('style')).toContain('width: 52px')
    expect(wrapper.get('.file-upload-wrapper').attributes('style')).toContain('height: 208px')
    wrapper.unmount()
  })

  it('stores calculated dimensions after loading an image without them', async () => {
    const updateAttributes = vi.fn()
    const wrapper = mountAttachment({
      name: 'portrait.png',
      type: 'image/png',
      url: 'portrait.png',
    }, vi.fn(async () => ({ url: 'blob:portrait', type: 'image/png' })), false, updateAttributes)

    await flushPromises()
    const image = wrapper.get('.image-preview img').element
    Object.defineProperties(image, {
      naturalWidth: { value: 100 },
      naturalHeight: { value: 400 },
    })
    await wrapper.get('.image-preview img').trigger('load')

    expect(updateAttributes).toHaveBeenCalledWith({ width: 52, height: 208 })
    wrapper.unmount()
  })
})
