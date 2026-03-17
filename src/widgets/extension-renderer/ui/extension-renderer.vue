<script setup lang="ts">
import { computed, markRaw, ref, watch } from 'vue'
import { useExtensions } from '@/hooks/useExtensions'

const props = defineProps({
  // 扩展ID
  extensionId: {
    type: String,
    required: true,
  },
  // 要渲染的组件名称
  componentName: {
    type: String,
    required: true,
  },
  // 传递给组件的属性
  componentProps: {
    type: Object,
    default: () => ({}),
  },
})

const { isExtensionEnabled, isExtensionLoaded, loadExtension, getExtensionModule } = useExtensions()

// 组件加载状态
const loading = ref(false)
const error = ref('')
const componentInstance = ref(null)

// 计算属性：检查扩展是否启用
const extensionEnabled = computed(() => isExtensionEnabled(props.extensionId))

// 加载扩展组件
async function loadExtensionComponent() {
  if (!extensionEnabled.value) {
    componentInstance.value = null
    return
  }

  // 如果组件已经加载且扩展已加载，直接返回
  if (componentInstance.value && isExtensionLoaded(props.extensionId)) {
    return
  }

  if (!isExtensionLoaded(props.extensionId)) {
    try {
      loading.value = true
      error.value = ''
      await loadExtension(props.extensionId)
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : '加载扩展失败'
      console.error(`ExtensionRenderer: 加载扩展 ${props.extensionId} 失败:`, err)
      return
    }
    finally {
      loading.value = false
    }
  }

  // 获取扩展模块
  const module = getExtensionModule(props.extensionId)
  if (!module) {
    error.value = '扩展模块不可用'
    return
  }

  // 获取组件
  // 检查是否为默认导出或命名导出
  let component

  // 尝试从不同的位置获取组件
  if (module[props.componentName]) {
    // 直接从模块获取
    component = module[props.componentName]
  }
  else if (module.default && module.default[props.componentName]) {
    // 从默认导出中获取
    component = module.default[props.componentName]
  }
  else if (module.default && typeof module.default === 'object') {
    // 检查默认导出的所有属性
    for (const key in module.default) {
      if (key.toLowerCase() === props.componentName.toLowerCase()) {
        component = module.default[key]
        break
      }
    }
  }

  // 如果仍然找不到组件，记录错误
  if (!component) {
    console.error(`ExtensionRenderer: 在模块中找不到组件 ${props.componentName}，可用组件:`, Object.keys(module), module.default ? Object.keys(module.default) : '无默认导出')
    error.value = `组件 ${props.componentName} 不存在`
    return
  }

  componentInstance.value = markRaw(component)
}

// 监听扩展状态变化
watch(() => extensionEnabled.value, loadExtensionComponent, { immediate: true })

// 移除 onMounted 中的重复调用，因为 watch 已经有 immediate: true
</script>

<template>
  <div>
    <!-- 加载状态 -->
    <div v-if="loading" class="extension-loading">
      <span>加载中...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="extension-error">
      <span>{{ error }}</span>
    </div>

    <!-- 渲染组件 -->
    <template v-else-if="componentInstance && extensionEnabled">
      <component
        :is="componentInstance"
        v-bind="componentProps"
      />
    </template>
  </div>
</template>

<style scoped>
.extension-loading,
.extension-error {
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
}

.extension-error {
  color: #dc3545;
}
</style>
