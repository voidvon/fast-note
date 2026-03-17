<script setup lang="ts">
import { IonButton, IonIcon, IonLabel } from '@ionic/vue'

// 1. 定义组件的 Props
interface Props {
  icon?: object | string // icon 可以是 import 的对象，也可以是字符串
  text: string
  color?: string // Ionic 的主题色, e.g., 'primary', 'secondary'
  href?: string // 如果提供，则作为链接跳转
}

// 使用 withDefaults 为可选 prop 提供默认值
const props = withDefaults(defineProps<Props>(), {
  color: undefined,
  href: undefined,
  icon: undefined,
})

// 2. 定义组件的 Events
const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

// 3. 事件处理函数
function handleClick(event: MouseEvent) {
  // 只有在没有提供 href 时才触发 click 事件，避免重复响应
  if (!props.href) {
    emit('click', event)
  }
}
</script>

<template>
  <IonButton
    fill="clear"
    :href="props.href"
    class="p-0 w-full h-full rounded-2xl"
    @click="handleClick"
  >
    <div class="flex flex-col items-center justify-center p-2 w-full h-full">
      <IonIcon
        v-if="props.icon"
        :icon="props.icon"
        aria-hidden="true"
        class="text-4xl mb-1.5"
      />
      <IonLabel class="text-base font-medium tracking-wide">
        {{ props.text }}
      </IonLabel>
    </div>
  </IonButton>
</template>

<style lang="scss" scoped>
/*
  使用 SCSS 来处理更复杂的样式和 Ionic CSS 自定义属性
*/

// :host 选择器用于定义组件根元素本身的样式
:host {
  display: flex;
  // 推荐设置宽高比，以保证在不同尺寸的网格中保持统一形状
  aspect-ratio: 1 / 1;
  width: 100%;
}

ion-button {
  // 确保 ion-button 填满 :host 元素
  width: 100%;
  height: 100%;

  // 增加圆角
  --border-radius: 12px;

  // 自定义背景色（可以通过 CSS 变量覆盖）
  --background: var(--c-blue-gray-800);

  // 重置 Ionic button 的默认内边距，让我们的 UnoCSS padding 生效
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
  transition: all 0.2s ease-in-out;
  &:active {
    transform: scale(0.98);
  }
}

ion-label {
  // 防止长文本换行破坏布局
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 95%; // 留一点空间
}
</style>
