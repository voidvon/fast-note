import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

function createIonicStub(name: string, tag = 'div') {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(tag, attrs, slots.default ? slots.default() : [])
    },
  })
}

async function mountSmartBackButton(options: {
  canGoBack: boolean
  fallbackPath: string
  targetPath?: string
}) {
  vi.resetModules()

  const navigate = vi.fn()

  vi.doMock('@ionic/vue', () => ({
    IonButton: createIonicStub('IonButton', 'button'),
    IonIcon: createIonicStub('IonIcon', 'span'),
    isPlatform: (platform: string) => platform === 'ios',
    useIonRouter: () => ({
      canGoBack: () => options.canGoBack,
      navigate,
    }),
  }))

  const SmartBackButton = (await import('@/components/SmartBackButton.vue')).default
  const wrapper = mount(SmartBackButton, {
    props: {
      fallbackPath: options.fallbackPath,
      targetPath: options.targetPath,
    },
  })

  return {
    navigate,
    wrapper,
  }
}

describe('smart back button', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('navigates to the smart back target when ionic history can go back', async () => {
    const { wrapper, navigate } = await mountSmartBackButton({
      canGoBack: true,
      fallbackPath: '/home',
      targetPath: '/f/folder-1',
    })

    await wrapper.get('button').trigger('click')

    expect(navigate).toHaveBeenCalledWith('/f/folder-1', 'back', 'push')
  })

  it('replaces the current entry with the fallback when opened directly', async () => {
    const { wrapper, navigate } = await mountSmartBackButton({
      canGoBack: false,
      fallbackPath: '/home',
      targetPath: '/f/folder-1',
    })

    await wrapper.get('button').trigger('click')

    expect(navigate).toHaveBeenCalledWith('/home', 'back', 'replace')
  })
})
