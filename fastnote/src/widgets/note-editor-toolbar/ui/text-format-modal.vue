<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { IonButton, IonIcon, IonModal, IonText } from '@ionic/vue'
import { closeCircle } from 'ionicons/icons'
import { onMounted, ref } from 'vue'
import Icon from '@/shared/ui/icon'

withDefaults(defineProps<{
  isOpen: boolean
  editor: Editor
}>(), {})

defineEmits(['update:isOpen'])

const modalHeight = 261
const modalHeightPecent = ref(0.35)
const modalRef = ref()

onMounted(() => {
  modalHeightPecent.value = modalHeight / window.innerHeight
})
</script>

<template>
  <IonModal
    ref="modalRef"
    v-bind="$attrs"
    :is-open
    :initial-breakpoint="modalHeightPecent"
    :breakpoints="[0, modalHeightPecent]"
    :backdrop-breakpoint="0.75"
    @did-dismiss="$emit('update:isOpen', false)"
  >
    <div class="text-format-modal-content px-5">
      <div class="flex justify-between items-center">
        <IonText>
          <h3>格式</h3>
        </IonText>
        <IonButton fill="clear" class="close-btn mr-[-8px]" @click="$emit('update:isOpen', false)">
          <IonIcon slot="icon-only" :icon="closeCircle" />
        </IonButton>
      </div>
      <div class="font-size flex items-center justify-between">
        <IonButton
          :fill="editor.isActive('heading', { level: 1 }) ? undefined : 'clear'"
          size="small"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        >
          <h1>标题</h1>
        </IonButton>
        <IonButton
          :fill="editor.isActive('heading', { level: 2 }) ? undefined : 'clear'"
          size="small"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          <h2>副标题</h2>
        </IonButton>
        <IonButton
          :fill="editor.isActive('heading', { level: 3 }) ? undefined : 'clear'"
          size="small"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          <h3>小标题</h3>
        </IonButton>
        <IonButton
          :fill="editor.isActive('paragraph') ? undefined : 'clear'"
          class="text-4"
          size="small"
          @click="editor.chain().focus().setParagraph().run()"
        >
          正文
        </IonButton>
      </div>
      <div class="font-style flex">
        <IonButton
          :fill="editor.isActive('bold') ? undefined : 'clear'"
          expand="full"
          @click="editor.chain().focus().toggleBold().run()"
        >
          <Icon name="bold" class="text-6" />
        </IonButton>
        <IonButton
          :fill="editor.isActive('italic') ? undefined : 'clear'"
          expand="full"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <Icon name="italic" class="text-6" />
        </IonButton>
        <IonButton
          :fill="editor.isActive('underline') ? undefined : 'clear'"
          expand="full"
          @click="editor.chain().focus().toggleUnderline().run()"
        >
          <Icon name="underline" class="text-6" />
        </IonButton>
        <IonButton
          :fill="editor.isActive('strike') ? undefined : 'clear'"
          expand="full"
          @click="editor.chain().focus().toggleStrike().run()"
        >
          <Icon name="strikethrough" class="text-6" />
        </IonButton>
      </div>
      <div class="flex">
        <div class="list-format flex flex-1">
          <IonButton
            :fill="editor.isActive('bulletList') ? undefined : 'clear'"
            expand="full"
            @click="editor.chain().focus().toggleBulletList().run()"
          >
            <Icon name="unorderedlist" class="text-6" />
          </IonButton>
          <IonButton
            :fill="editor.isActive('orderedList') ? undefined : 'clear'"
            expand="full"
            @click="editor.chain().focus().toggleOrderedList().run()"
          >
            <Icon name="orderedlist" class="text-6" />
          </IonButton>
        </div>
        <div class="list-indent flex flex-1">
          <IonButton
            fill="clear"
            expand="full"
            @click="editor.chain().focus().liftListItem('listItem').run()"
          >
            <Icon name="outdent" class="text-6" />
          </IonButton>
          <IonButton
            fill="clear"
            expand="full"
            @click="editor.chain().focus().sinkListItem('listItem').run()"
          >
            <Icon name="indent" class="text-6" />
          </IonButton>
        </div>
      </div>
    </div>
  </IonModal>
</template>

<style lang="scss">
.text-format-modal-content {
  .close-btn {
    --color: var(--c-blue-gray-300);
    ion-icon {
      font-size: 28px;
    }
  }
  .font-size {
    ion-button {
      --color: var(--c-gray-0);
      --padding-start: 10px;
      --padding-end: 10px;
    }
    h1,
    h2,
    h3 {
      margin: 0;
    }
  }
  .font-style,
  .list-format,
  .list-indent {
    ion-button {
      --background: var(--primary);
      --color: var(--c-gray-0);
      --background-activated: var(--primary);
      --padding-top: 6px;
      --padding-bottom: 6px;
      flex: 1;
      overflow: hidden;
      &[fill='clear'] {
        --background: var(--c-blue-gray-800);
      }
      &:first-child {
        border-top-left-radius: 6px;
        border-bottom-left-radius: 6px;
      }
      &:last-child {
        border-top-right-radius: 6px;
        border-bottom-right-radius: 6px;
      }
    }
  }
}
</style>
