import type { Extension, ExtensionState } from '@/shared/types/extension'
import { reactive, watch } from 'vue'

const state = reactive<ExtensionState>({
  extensions: [],
  initialized: false,
  loadedExtensions: {},
})

let initPromise: Promise<void> | null = null
let isInitializing = false
const loadingPromises = new Map<string, Promise<boolean>>()
const availableExtensions: any[] = []

async function initExtensions(): Promise<void> {
  if (state.initialized) {
    console.log('扩展系统已经初始化，跳过重复初始化')
    return
  }

  if (initPromise) {
    console.log('扩展系统正在初始化，等待完成...')
    return initPromise
  }

  initPromise = (async () => {
    try {
      console.log('开始初始化扩展系统')

      state.extensions = availableExtensions.map(ext => ({
        ...ext,
        enabled: false,
      }))

      const savedExtensions = localStorage.getItem('app_extensions')
      if (savedExtensions) {
        try {
          const parsed = JSON.parse(savedExtensions)
          state.extensions = state.extensions.map((ext) => {
            const savedExt = parsed.find((se: Extension) => se.id === ext.id)
            return savedExt ? { ...ext, enabled: savedExt.enabled } : ext
          })

          console.log('已加载扩展配置:', state.extensions.filter(ext => ext.enabled).map(ext => ext.id))

          for (const ext of state.extensions) {
            if (ext.enabled) {
              await loadExtension(ext.id)
            }
          }
        }
        catch (e) {
          console.error('加载扩展状态失败:', e)
        }
      }

      state.initialized = true
      console.log('扩展系统初始化完成')
    }
    finally {
      initPromise = null
      isInitializing = false
    }
  })()

  return initPromise
}

async function loadExtension(id: string): Promise<boolean> {
  if (state.loadedExtensions[id]) {
    console.log(`扩展 ${id} 已经加载，跳过重复加载`)
    return true
  }

  if (loadingPromises.has(id)) {
    console.log(`扩展 ${id} 正在加载，等待完成...`)
    return loadingPromises.get(id)!
  }

  const loadPromise = (async (): Promise<boolean> => {
    try {
      const extension = state.extensions.find(ext => ext.id === id)
      if (!extension) {
        console.error(`扩展 ${id} 不存在`)
        return false
      }

      console.log(`开始加载扩展 ${id}`)
      console.error(`扩展系统已废弃，扩展ID ${id} 不可用`)
      return false
    }
    catch (error) {
      console.error(`加载扩展 ${id} 失败:`, error)
      delete state.loadedExtensions[id]
      return false
    }
    finally {
      loadingPromises.delete(id)
    }
  })()

  loadingPromises.set(id, loadPromise)
  return loadPromise
}

function unloadExtension(id: string): boolean {
  const extension = state.extensions.find(ext => ext.id === id)
  if (!extension) {
    console.error(`扩展 ${id} 不存在`)
    return false
  }

  if (state.loadedExtensions[id]) {
    delete state.loadedExtensions[id]
  }

  return true
}

watch(
  () => state.extensions.map(ext => ({ id: ext.id, enabled: ext.enabled })),
  (newExtensions) => {
    localStorage.setItem('app_extensions', JSON.stringify(newExtensions))
  },
  { deep: true },
)

export function useExtensions() {
  if (!state.initialized && !isInitializing) {
    isInitializing = true
    initExtensions()
  }

  const isExtensionEnabled = (id: string): boolean => {
    const ext = state.extensions.find(ext => ext.id === id)
    return ext?.enabled || false
  }

  const isExtensionLoaded = (id: string): boolean => {
    return !!state.loadedExtensions[id]
  }

  const getExtensionModule = (id: string): any => {
    return state.loadedExtensions[id]
  }

  const toggleExtension = async (id: string) => {
    const extension = state.extensions.find(ext => ext.id === id)
    if (!extension) {
      throw new Error(`扩展 ${id} 不存在`)
    }

    extension.enabled = !extension.enabled

    if (extension.enabled) {
      await loadExtension(id)
    }
    else {
      unloadExtension(id)
    }
  }

  const enableExtension = async (id: string) => {
    const extension = state.extensions.find(ext => ext.id === id)
    if (!extension) {
      throw new Error(`扩展 ${id} 不存在`)
    }

    extension.enabled = true
    await loadExtension(id)
  }

  const disableExtension = (id: string) => {
    const extension = state.extensions.find(ext => ext.id === id)
    if (!extension) {
      throw new Error(`扩展 ${id} 不存在`)
    }

    extension.enabled = false
    unloadExtension(id)
  }

  return {
    extensions: state.extensions,
    initialized: state.initialized,
    isExtensionEnabled,
    isExtensionLoaded,
    getExtensionModule,
    toggleExtension,
    enableExtension,
    disableExtension,
    loadExtension,
    unloadExtension,
    initExtensions,
  }
}
