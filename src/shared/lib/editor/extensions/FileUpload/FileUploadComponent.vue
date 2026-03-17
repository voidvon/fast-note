<script setup lang="ts">
import { NodeViewWrapper } from '@tiptap/vue-3'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { FileCategory, getFileCategoryByMimeType, getFileIcon, isImageFile } from '@/utils/mimeTypes'

interface Extension {
  name: string
  options: {
    loadFile?: (url: string) => Promise<{ url: string, type: string }>
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
  url: props.node.attrs.url,
}))

// 获取 fileUpload 扩展实例
const fileUploadExtension = computed<Extension | undefined>(() => {
  // 使用 as 类型断言
  return (props.editor?.extensionManager?.extensions as Extension[] | undefined)?.find(
    ext => ext.name === 'fileUpload',
  )
})

// 检查URL是否为SHA256哈希值格式
const isSha256Hash = computed(() => {
  const url = nodeProps.value.url
  if (!url)
    return false
  // SHA256哈希通常是64个16进制字符
  return /^[a-f0-9]{64}$/i.test(url)
})

const imageRef = ref<HTMLImageElement | null>(null)
const containerSize = ref({ width: '88px', height: '88px' })
const imageUrl = ref('')
const isLoading = ref(true)
const hasError = ref(false)
const fileTypeName = ref('') // 存储从loadFile返回的文件类型
const naturalSize = ref({ width: 0, height: 0 })

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

  // 否则根据URL检查
  return isImageFile(url)
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

  return getFileIcon(url)
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
  hasError.value = true
}

// 使用扩展的 loadFile 方法加载文件
async function loadFileWithExtension(url: string) {
  // 设置加载状态
  isLoading.value = true
  hasError.value = false
  imageUrl.value = url // 默认使用原始URL

  // 使用扩展的 loadFile 方法
  const loadFile = fileUploadExtension.value?.options?.loadFile

  if (loadFile) {
    try {
      const result = await loadFile(url)
      if (result && 'url' in result) {
        imageUrl.value = result.url
        fileTypeName.value = result.type || '' // 存储文件类型
      }
    }
    catch (extensionError) {
      // 如果扩展方法抛出错误，直接使用原始 URL
      console.warn('扩展加载文件失败，使用原始URL:', extensionError)
    }
  }
  isLoading.value = false
}

// 检查是否需要加载文件（hash值或可能的PocketBase文件名都需要加载）
const needsFileLoading = computed(() => {
  const url = nodeProps.value.url
  if (!url)
    return false

  // hash值需要加载
  if (isSha256Hash.value)
    return true

  // 图片类型需要加载
  if (isImage.value)
    return true

  // 可能是PocketBase文件名，也尝试加载
  // 如果不是明显的web URL格式，就认为可能需要从PocketBase加载
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:') && !url.startsWith('blob:')) {
    return true
  }

  return false
})

// 监听URL变化，加载文件
watch(
  () => nodeProps.value.url,
  (newUrl) => {
    if (newUrl && needsFileLoading.value) {
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
    }
  }
  return containerSize.value
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
function handleFileClick(event: Event) {
  // 阻止事件冒泡，防止聚焦编辑器
  event.preventDefault()
  event.stopPropagation()

  // 这里可以添加非图片文件的处理逻辑，比如弹出菜单
  console.warn('点击了非图片文件:', nodeProps.value.url)
}

// 组件挂载时加载文件
onMounted(() => {
  // 加载文件
  if (nodeProps.value.url && needsFileLoading.value) {
    loadFileWithExtension(nodeProps.value.url)
  }
  else {
    isLoading.value = false
  }
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
      <div v-else class="file-preview" @click="handleFileClick">
        <img :src="fileTypeIcon" :alt="fileType">
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
  }
  .file-upload-content .file-upload-wrapper.is-selected {
    border-color: #2196f3;
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
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
    width: 100%;
    height: 100%;
    object-fit: contain;
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
