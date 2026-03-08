import type { Extension, ExtensionState } from '@/types/extension'
import { reactive, watch } from 'vue'

// 创建一个响应式状态来管理扩展
const state = reactive<ExtensionState>({
  extensions: [],
  initialized: false,
  loadedExtensions: {}, // 存储已加载的扩展模块
})

// 用于防止重复初始化的 Promise
let initPromise: Promise<void> | null = null

// 全局标记，防止多次调用
let isInitializing = false

// 用于防止重复加载扩展的 Promise Map
const loadingPromises = new Map<string, Promise<boolean>>()

// 可用扩展的元数据
// 注意：PocketBase 功能已迁移到核心层，不再作为扩展提供
const availableExtensions: any[] = []

// 初始化内置扩展
async function initExtensions(): Promise<void> {
  // 如果已经初始化，直接返回
  if (state.initialized) {
    console.log('扩展系统已经初始化，跳过重复初始化')
    return
  }

  // 如果正在初始化，等待初始化完成
  if (initPromise) {
    console.log('扩展系统正在初始化，等待完成...')
    return initPromise
  }

  // 创建初始化 Promise
  initPromise = (async () => {
    try {
      console.log('开始初始化扩展系统')

      // 添加所有可用扩展的元数据
      state.extensions = availableExtensions.map(ext => ({
        ...ext,
        enabled: false, // 默认禁用
      }))

      // 从本地存储加载扩展状态
      const savedExtensions = localStorage.getItem('app_extensions')
      if (savedExtensions) {
        try {
          const parsed = JSON.parse(savedExtensions)
          // 合并保存的状态和默认状态
          state.extensions = state.extensions.map((ext) => {
            const savedExt = parsed.find((se: Extension) => se.id === ext.id)
            return savedExt ? { ...ext, enabled: savedExt.enabled } : ext
          })

          console.log('已加载扩展配置:', state.extensions.filter(ext => ext.enabled).map(ext => ext.id))

          // 加载已启用的扩展
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
      // 清除 Promise 引用和标记
      initPromise = null
      isInitializing = false
    }
  })()

  return initPromise
}

// 动态加载扩展
async function loadExtension(id: string): Promise<boolean> {
  // 如果扩展已经加载，直接返回
  if (state.loadedExtensions[id]) {
    console.log(`扩展 ${id} 已经加载，跳过重复加载`)
    return true
  }

  // 如果正在加载，等待加载完成
  if (loadingPromises.has(id)) {
    console.log(`扩展 ${id} 正在加载，等待完成...`)
    return loadingPromises.get(id)!
  }

  // 创建加载 Promise
  const loadPromise = (async (): Promise<boolean> => {
    try {
      const extension = state.extensions.find(ext => ext.id === id)
      if (!extension) {
        console.error(`扩展 ${id} 不存在`)
        return false
      }

      console.log(`开始加载扩展 ${id}`)

      // 动态导入扩展模块
      // 注意：扩展系统已废弃，所有功能已迁移到核心层
      console.error(`扩展系统已废弃，扩展ID ${id} 不可用`)
      return false
    }
    catch (error) {
      console.error(`加载扩展 ${id} 失败:`, error)
      // 如果加载失败，清除已存储的模块
      delete state.loadedExtensions[id]
      return false
    }
    finally {
      // 清除加载 Promise
      loadingPromises.delete(id)
    }
  })()

  // 存储加载 Promise
  loadingPromises.set(id, loadPromise)

  return loadPromise
}

// 卸载扩展
function unloadExtension(id: string): boolean {
  // 如果扩展已加载，尝试调用其卸载方法
  if (state.loadedExtensions[id]) {
    const module = state.loadedExtensions[id]
    if (module.default && typeof module.default.uninstall === 'function') {
      try {
        const app = (window as any).__VUE_APP__
        if (app) {
          module.default.uninstall(app)
        }
      }
      catch (error) {
        console.error(`卸载扩展 ${id} 失败:`, error)
      }
    }

    // 从已加载扩展中移除
    delete state.loadedExtensions[id]

    return true
  }
  return false
}

// 保存扩展状态到本地存储
function saveExtensionState() {
  localStorage.setItem('app_extensions', JSON.stringify(state.extensions))
}

// 监听扩展状态变化并保存
watch(() => [...state.extensions], saveExtensionState, { deep: true })

export function useExtensions() {
  // 确保扩展已初始化（只初始化一次）
  if (!state.initialized && !isInitializing) {
    isInitializing = true
    // 异步初始化，但不等待完成，让组件可以立即获取到函数
    initExtensions().catch(console.error)
  }

  // 获取所有扩展
  const getAllExtensions = () => state.extensions

  // 获取特定扩展
  const getExtension = (id: string) => state.extensions.find(ext => ext.id === id)

  // 检查扩展是否启用
  const isExtensionEnabled = (id: string) => {
    const extension = getExtension(id)
    return extension ? extension.enabled : false
  }

  // 检查扩展是否已加载
  const isExtensionLoaded = (id: string) => !!state.loadedExtensions[id]

  // 切换扩展状态
  const toggleExtension = async (id: string) => {
    const extension = getExtension(id)
    if (!extension)
      return

    const newState = !extension.enabled
    extension.enabled = newState

    // 根据新状态加载或卸载扩展
    if (newState) {
      // 启用扩展时加载
      await loadExtension(id)
    }
    else {
      // 禁用扩展时卸载
      unloadExtension(id)
    }
  }

  // 启用扩展
  const enableExtension = async (id: string) => {
    const extension = getExtension(id)
    if (extension && !extension.enabled) {
      extension.enabled = true
      await loadExtension(id)
    }
  }

  // 禁用扩展
  const disableExtension = (id: string) => {
    const extension = getExtension(id)
    if (extension && extension.enabled) {
      extension.enabled = false
      unloadExtension(id)
    }
  }

  // 获取扩展模块
  const getExtensionModule = (id: string) => {
    return state.loadedExtensions[id] || null
  }

  return {
    extensions: state.extensions,
    getAllExtensions,
    getExtension,
    isExtensionEnabled,
    isExtensionLoaded,
    toggleExtension,
    enableExtension,
    disableExtension,
    getExtensionModule,
    loadExtension, // 导出loadExtension方法
  }
}
