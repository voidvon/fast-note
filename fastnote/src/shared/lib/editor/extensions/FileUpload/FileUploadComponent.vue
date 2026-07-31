<script setup lang="ts">
import { NodeViewWrapper } from '@tiptap/vue-3'
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { FileCategory, getFileCategoryByMimeType, getFileIcon } from '@/shared/lib/mime-types'
import {
  getAttachmentDisplayName,
  isLikelyImageAttachment,
  shouldAutoLoadAttachment,
} from './file-loading'

interface Extension {
  name: string
  options: {
    loadFile?: (url: string, options?: { force?: boolean }) => Promise<{ url: string, type: string }>
    onImageLoaded?: (url: string, width: number, height: number) => void
  }
}

const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  getPos: {
    type: Function,
    required: true,
  },
  editor: {
    type: Object,
    required: true,
  },
})

const nodeProps = computed(() => ({
  name: props.node.attrs.name as string | null,
  size: props.node.attrs.size as number | null,
  type: props.node.attrs.type as string | null,
  url: props.node.attrs.url,
}))

// 获取 fileUpload 扩展实例
const fileUploadExtension = computed<Extension | undefined>(() => {
  // 使用 as 类型断言
  return (props.editor?.extensionManager?.extensions as Extension[] | undefined)?.find(
    ext => ext.name === 'fileUpload',
  )
})

const imageRef = ref<HTMLImageElement | null>(null)
const containerSize = ref({ width: '88px', height: '88px' })
const imageUrl = ref('')
const isLoading = ref(shouldAutoLoadAttachment(nodeProps.value))
const hasError = ref(false)
const fileTypeName = ref('') // 存储从loadFile返回的文件类型
const naturalSize = ref({ width: 0, height: 0 })
const displayName = computed(() => getAttachmentDisplayName(nodeProps.value))
let loadRequestId = 0

// 注入父组件提供的预览功能
const openPhotoSwipe = inject<(imageUrl: string, width: number, height: number) => void>('openPhotoSwipe')

const isImage = computed(() => {
  const url = nodeProps.value.url
  if (!url)
    return false

  // 如果有MIME类型，使用工具函数检查
  if (fileTypeName.value) {
    return getFileCategoryByMimeType(fileTypeName.value) === FileCategory.IMAGE
  }

  return isLikelyImageAttachment(nodeProps.value)
})

const fileType = computed(() => {
  // 如果有从服务器返回的文件类型，使用工具函数获取图标
  if (fileTypeName.value) {
    return getFileIcon({ type: fileTypeName.value } as File)
  }

  // 否则根据URL获取图标
  const url = nodeProps.value.url
  if (!url)
    return 'unknown'

  return getFileIcon(nodeProps.value.name || url)
})

// 从fileType派生是否是图片
const isPictureType = computed(() => {
  return fileType.value === 'picture'
})

const fileTypeIcon = computed(() => {
  return `/file/${fileType.value}.svg`
})

// 图片尺寸常量
const DEFAULT_SIZE = 88
const MAX_SIZE = 208

/**
 * 图片加载完成后计算尺寸：等比例缩放图片尺寸
 * 1. 高度等比例缩放到DEFAULT_SIZE，检查宽度
 * 2. 宽度等比例缩放到DEFAULT_SIZE，检查高度
 * 3. 否则，宽度设置为DEFAULT_SIZE，高度等比例缩放
 * @param event 事件对象
 */
function onImageLoad(event: Event) {
  const img = event.target as HTMLImageElement
  const naturalWidth = img.naturalWidth
  const naturalHeight = img.naturalHeight
  const aspectRatio = naturalWidth / naturalHeight

  // 保存图片原始尺寸，用于PhotoSwipe
  naturalSize.value = {
    width: naturalWidth,
    height: naturalHeight,
  }

  // 1. 高度等比例缩放到DEFAULT_SIZE，检查宽度
  let height = DEFAULT_SIZE
  let width = height * aspectRatio
  if (width > MAX_SIZE) {
    // 如果宽度大于MAX_SIZE，则宽度等比例缩放到MAX_SIZE
    width = MAX_SIZE
    height = width / aspectRatio
  }
  else {
    // 2. 宽度等比例缩放到DEFAULT_SIZE，检查高度
    width = DEFAULT_SIZE
    height = width / aspectRatio
    if (height > MAX_SIZE) {
      // 如果高度大于MAX_SIZE，则高度等比例缩放到MAX_SIZE
      height = MAX_SIZE
      width = height * aspectRatio
    }
    else {
      // 3. 否则，宽度设置为DEFAULT_SIZE，高度等比例缩放
      width = DEFAULT_SIZE
      height = width / aspectRatio
    }
  }

  containerSize.value = {
    width: `${width}px`,
    height: `${height}px`,
  }

  // 通知YYEditor中配置的onImageLoaded方法图片已加载完成
  try {
    const onImageLoaded = fileUploadExtension.value?.options?.onImageLoaded
    if (onImageLoaded && imageUrl.value) {
      onImageLoaded(imageUrl.value, naturalWidth, naturalHeight)
    }
  }
  catch (error) {
    console.warn('调用onImageLoaded方法失败:', error)
  }
}

// 图片加载失败
function onImageError() {
  if (isLoading.value || !imageUrl.value)
    return
  hasError.value = true
}

// 使用扩展的 loadFile 方法加载文件
function replaceImageUrl(url: string) {
  if (imageUrl.value.startsWith('blob:') && imageUrl.value !== url)
    URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = url
}

async function loadFileWithExtension(url: string, options: { force?: boolean } = {}) {
  const requestId = ++loadRequestId
  // 设置加载状态
  isLoading.value = true
  hasError.value = false

  // 使用扩展的 loadFile 方法
  const loadFile = fileUploadExtension.value?.options?.loadFile

  if (loadFile) {
    try {
      const result = await loadFile(url, options)
      if (result && 'url' in result) {
        if (requestId !== loadRequestId) {
          if (result.url.startsWith('blob:'))
            URL.revokeObjectURL(result.url)
          return null
        }
        replaceImageUrl(result.url)
        fileTypeName.value = result.type || '' // 存储文件类型
        isLoading.value = false
        return result
      }
    }
    catch (extensionError) {
      if (requestId !== loadRequestId)
        return null
      // 如果扩展方法抛出错误，直接使用原始 URL
      console.warn('扩展加载文件失败，使用原始URL:', extensionError)
      hasError.value = true
    }
  }
  if (requestId === loadRequestId)
    isLoading.value = false
  return null
}

const needsAutomaticLoading = computed(() => shouldAutoLoadAttachment(nodeProps.value))

// 监听URL变化，加载文件
watch(
  () => nodeProps.value.url,
  (newUrl) => {
    if (newUrl && needsAutomaticLoading.value) {
      loadFileWithExtension(newUrl)
    }
    else {
      isLoading.value = false
    }
  },
)

const wrapperStyle = computed(() => {
  if (!isImage.value && !isPictureType.value) {
    return {
      width: '88px',
      height: '88px',
      verticalAlign: 'bottom',
    }
  }
  return {
    ...containerSize.value,
    verticalAlign: 'bottom',
  }
})

// 打开PhotoSwipe预览
function handleImageClick(event: Event) {
  // 阻止事件冒泡，防止聚焦编辑器
  event.preventDefault()
  event.stopPropagation()

  // 只有图片类型才能预览
  if (!isPictureType.value || hasError.value || isLoading.value || !openPhotoSwipe)
    return

  // 调用父组件提供的预览功能
  openPhotoSwipe(imageUrl.value, naturalSize.value.width, naturalSize.value.height)
}

// 处理非图片文件的点击事件
async function handleFileClick(event: Event) {
  // 阻止事件冒泡，防止聚焦编辑器
  event.preventDefault()
  event.stopPropagation()

  const url = nodeProps.value.url
  if (!url || isLoading.value)
    return

  const result = await loadFileWithExtension(url, { force: true })
  if (!result)
    return

  const anchor = document.createElement('a')
  anchor.href = result.url
  anchor.download = displayName.value
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

// 组件挂载时加载文件
onMounted(() => {
  // 加载文件
  if (nodeProps.value.url && needsAutomaticLoading.value) {
    loadFileWithExtension(nodeProps.value.url)
  }
  else {
    isLoading.value = false
  }
})

onBeforeUnmount(() => {
  loadRequestId++
  if (imageUrl.value.startsWith('blob:'))
    URL.revokeObjectURL(imageUrl.value)
})
</script>

<template>
  <NodeViewWrapper
    class="file-upload-wrapper" :class="[{ 'is-selected': selected }]"
    :style="wrapperStyle"
  >
    <div class="file-upload-content w-full h-full">
      <div v-if="isLoading" class="loading-wrapper">
        <div class="loading-spinner" />
      </div>
      <div v-else-if="isImage || isPictureType" class="image-preview">
        <div v-if="!isLoading && hasError" class="error-wrapper">
          <span class="error-text">图片加载失败</span>
        </div>
        <img
          v-else
          ref="imageRef"
          :src="imageUrl"
          :alt="fileType"
          class="cursor-pointer"
          @load="onImageLoad"
          @error="onImageError"
          @click="handleImageClick"
        >
      </div>
      <div v-else class="file-preview cursor-pointer" :title="displayName" @click="handleFileClick">
        <img :src="fileTypeIcon" :alt="fileType">
        <span class="file-name">{{ displayName }}</span>
      </div>
    </div>
  </NodeViewWrapper>
</template>

<style lang="scss">
.file-upload-wrapper {
  padding: 0;
  padding: 4px;
  display: inline-block;
  /* transition: all 20s ease; */
  position: relative;
  .file-upload-content {
    /* border: 1px solid #ddd; */
    box-shadow: 0 0 0 1px #ddd;
    border-radius: 4px;
    transition: box-shadow 120ms ease;
  }
  &.is-selected > .file-upload-content {
    box-shadow:
      0 0 0 2px var(--ion-color-primary, #3880ff),
      0 0 0 5px rgba(56, 128, 255, 0.22);
  }

  .image-preview,
  .file-preview {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .image-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 4px;
  }

  .file-preview img {
    width: 52px;
    height: 52px;
    object-fit: contain;
  }

  .file-preview {
    flex-direction: column;
    gap: 2px;
    padding: 4px;
  }

  .file-name {
    width: 100%;
    overflow: hidden;
    color: var(--ion-text-color, #202124);
    font-size: 10px;
    line-height: 14px;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loading-wrapper,
  .error-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    border-radius: 4px;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #ddd;
    border-top-color: #2196f3;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .error-text {
    color: #f44336;
    font-size: 14px;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 鼠标悬停在图片上时显示可点击状态 */
.image-preview img {
  cursor: pointer;
}
.image-preview img:hover {
  opacity: 0.9;
}
</style>
