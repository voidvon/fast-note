<script lang="ts" setup>
import { EditorContent } from '@tiptap/vue-3'
import PhotoSwipe from 'photoswipe'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import { onMounted, onUnmounted, provide, ref } from 'vue'
import { useNoteEditor } from '@/features/note-editor'
import 'photoswipe/style.css'

defineOptions({
  name: 'YYEditor',
})

const emit = defineEmits(['focus', 'blur'])

const {
  editor,
  initEditor,
  insertFiles,
  extractFileHashes,
  getContentInfo,
  applyDefaultHeadingIfEmpty,
  isMeaningfulContent,
  setContent,
  getContent,
  setEditable,
  setInputMode,
} = useNoteEditor()

const lightbox = ref<any>(null)

function initPhotoSwipe() {
  try {
    lightbox.value = new PhotoSwipeLightbox({
      gallery: '#pswp-gallery',
      children: 'a',
      pswpModule: PhotoSwipe,
      showHideAnimationType: 'fade',
      closeOnVerticalDrag: true,
      arrowPrevTitle: '上一张',
      arrowNextTitle: '下一张',
      closeTitle: '关闭',
      zoomTitle: '缩放',
    })
    lightbox.value.init()
  }
  catch (error) {
    console.error('初始化 PhotoSwipe 失败:', error)
  }
}

function openPhotoSwipe(imageUrl: string, width: number, height: number) {
  try {
    const oldGallery = document.getElementById('pswp-gallery')
    if (oldGallery) {
      document.body.removeChild(oldGallery)
    }

    const galleryElement = document.createElement('div')
    galleryElement.id = 'pswp-gallery'
    galleryElement.style.display = 'none'
    document.body.appendChild(galleryElement)

    const linkElement = document.createElement('a')
    linkElement.href = imageUrl
    linkElement.dataset.pswpWidth = width.toString()
    linkElement.dataset.pswpHeight = height.toString()
    galleryElement.appendChild(linkElement)

    initPhotoSwipe()
    lightbox.value.loadAndOpen(0)
  }
  catch (error) {
    console.error('打开图片预览失败:', error)
  }
}

provide('openPhotoSwipe', openPhotoSwipe)

onMounted(() => {
  initEditor({
    onFocus: () => emit('focus'),
    onBlur: () => emit('blur'),
  })
})

onUnmounted(() => {
  try {
    if (lightbox.value) {
      lightbox.value.destroy()
      lightbox.value = null
    }

    const galleryElement = document.getElementById('pswp-gallery')
    if (galleryElement) {
      document.body.removeChild(galleryElement)
    }
  }
  catch (error) {
    console.error('清理 PhotoSwipe 资源失败:', error)
  }
})

async function handleFileInput(e: Event): Promise<string[]> {
  const files = (e.target as HTMLInputElement).files
  if (files) {
    return await insertFiles(files)
  }
  return []
}

defineExpose({
  getContent,
  getTitle: getContentInfo,
  extractFileHashes,
  applyDefaultNewNoteHeading: applyDefaultHeadingIfEmpty,
  isMeaningfulContent,
  setContent,
  setEditable,
  setInputMode,
  editor,
  insertFile: handleFileInput,
  insertFiles,
  focus: () => editor.value?.commands.focus(),
})
</script>

<template>
  <div v-if="editor" class="yy-editor">
    <EditorContent :editor="(editor as any)" />
  </div>
</template>

<style lang="scss">
.yy-editor {
  .tiptap-image {
    max-width: 100%;
    height: auto;

    &.loading {
      opacity: 0.5;
    }

    &.error {
      border: 1px solid var(--danger);
    }
  }
}

.tiptap {
  outline: none;
  padding: 16px;
  padding-bottom: 200px;
  :first-child {
    margin-top: 0;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  ul,
  ol {
    margin: 0;
    line-height: 1.6;
    text-wrap: pretty;
  }

  h1 {
    font-size: 1.75rem;
    margin: 0;
  }

  h2 {
    font-size: 1.375rem;
  }

  h3 {
    font-size: 1.0625rem;
    font-weight: 400;
  }

  h4,
  h5,
  h6 {
    font-size: 1rem;
  }

  code {
    background-color: #202329;
    border-radius: 0.4rem;
    padding: 0.25em 0.3em;
  }

  pre {
    background: #161b22;
    border-radius: 0.5rem;
    font-family: 'JetBrainsMono', monospace;
    margin: 8px 0;
    padding: 0.75rem 1rem;
    line-height: 1.45;
    font-size: 14px;
    code {
      background: none;
      padding: 0;
    }
  }

  blockquote {
    border-left: 3px solid var(--gray-3);
    margin: 1.5rem 0;
    padding-left: 1rem;
  }

  ul[data-type='taskList'] {
    list-style: none;
    margin-left: 0;
    padding: 0;

    li {
      align-items: center;
      display: flex;
      &[data-checked='true'] {
        label {
          background: url('/public/icons/check-circle-fill.svg') no-repeat center center;
          background-size: 100%;
        }
      }
      &[data-checked='false'] {
        label {
          background: url('/public/icons/circle.svg') no-repeat center center;
          background-size: 100%;
        }
      }

      > label {
        display: inline-flex;
        width: 22px;
        height: 22px;
        margin-right: 0.5rem;
        transform: translateY(-0.1em);
        cursor: pointer;
      }

      > div {
        flex: 1 1 auto;
      }
    }

    input[type='checkbox'] {
      opacity: 0;
      pointer-events: none;
    }
  }

  ul,
  ol {
    padding: 0;

    li p {
      margin-top: 0.25em;
      margin-bottom: 0.25em;
    }
  }

  ol {
    padding-left: 28px;
    li {
      ol {
        li {
          list-style-type: lower-alpha;
          ol {
            li {
              list-style-type: decimal-leading-zero;
            }
          }
        }
      }
    }
  }

  ul {
    padding-left: 28px;
    li {
      &::marker {
        font-size: 20px;
      }
    }
  }

  .table-wrapper {
    overflow-x: auto;
    margin: 10px 0;
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
      height: 8px;
    }

    &::-webkit-scrollbar-track {
      background: var(--c-blue-gray-800);
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--c-blue-gray-600);
      border-radius: 4px;

      &:hover {
        background: var(--c-blue-gray-500);
      }
    }
  }

  table {
    border-collapse: collapse;
    border-spacing: 0;
    border: 1px solid var(--c-blue-gray-700);
    width: 100%;
    margin: 0;

    td,
    th {
      border: 1px solid var(--c-blue-gray-700);
      padding: 8px;
      min-width: 100px;
    }

    th {
      background-color: var(--c-blue-gray-800);
      font-weight: 600;
    }
  }
}
</style>
