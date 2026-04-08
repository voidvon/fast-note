<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { IonIcon, IonItem, IonLabel, IonList, IonModal } from '@ionic/vue'
import { trashOutline } from 'ionicons/icons'
import { onMounted, ref } from 'vue'
import Icon from '@/shared/ui/icon'

const props = withDefaults(defineProps<{
  isOpen: boolean
  editor: Editor
}>(), {})

const emit = defineEmits(['update:isOpen'])

/**
 * 表格操作项：
 * 1. 插入表格
 * 2. 插入列（后面）
 * 3. 插入行（后面）
 * 4. 删除表格
 * 5. 删除行
 * 6. 删除列
 * 7. 拷贝行
 * 8. 拷贝列
 * 9. 剪切行
 * 10. 剪切列
 * 11. 粘贴行
 * 12. 粘贴列
 */

const modalHeight = 420
const modalHeightPecent = ref(0.35)
const modalRef = ref()

onMounted(() => {
  modalHeightPecent.value = modalHeight / window.innerHeight
})

function onClick(type: string) {
  switch (type) {
    case 'insert-table':
      props.editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run()
      break
    case 'delete-table':
      props.editor.chain().focus().deleteTable().run()
      break
    case 'add-column-after':
      props.editor.chain().focus().addColumnAfter().run()
      break
    case 'delete-column':
      props.editor.chain().focus().deleteColumn().run()
      break
    case 'add-row-after':
      props.editor.chain().focus().addRowAfter().run()
      break
    case 'delete-row':
      props.editor.chain().focus().deleteRow().run()
      break
  }
  emit('update:isOpen', false)
}
</script>

<template>
  <IonModal
    ref="modalRef"
    v-bind="$attrs"
    :is-open
    :initial-breakpoint="modalHeightPecent"
    :breakpoints="[0, modalHeightPecent]"
    :backdrop-breakpoint="0.75"
    class="table-format-modal"
    @did-dismiss="$emit('update:isOpen', false)"
  >
    <div>
      <IonList class="table-format-modal-list" inset>
        <IonItem @click="onClick('insert-table')">
          <IonLabel>插入表格</IonLabel>
          <div slot="end">
            <Icon name="table" />
          </div>
        </IonItem>
        <IonItem @click="onClick('delete-table')">
          <IonLabel style="color: var(--danger)">
            删除表格
          </IonLabel>
          <div slot="end">
            <IonIcon :icon="trashOutline" color="danger" />
          </div>
        </IonItem>
      </IonList>
      <IonList class="table-format-modal-list" inset>
        <IonItem @click="onClick('add-column-after')">
          <IonLabel>插入列</IonLabel>
          <div slot="end">
            <Icon name="insert-right-column" />
          </div>
        </IonItem>
        <IonItem @click="onClick('delete-column')">
          <IonLabel style="color: var(--danger)">
            删除列
          </IonLabel>
          <div slot="end">
            <Icon name="remove-column" color="danger" />
          </div>
        </IonItem>
      </IonList>
      <IonList class="table-format-modal-list" inset>
        <IonItem @click="onClick('add-row-after')">
          <IonLabel>插入行</IonLabel>
          <div slot="end">
            <Icon name="insert-bottom-row" />
          </div>
        </IonItem>
        <IonItem @click="onClick('delete-row')">
          <IonLabel style="color: var(--danger)">
            删除行
          </IonLabel>
          <div slot="end">
            <Icon name="remove-row" color="danger" />
          </div>
        </IonItem>
      </IonList>
    </div>
  </IonModal>
</template>

<style lang="scss">
.table-format-modal {
  --background: #222;
}
.table-format-modal-list {
  ion-item {
    --background: var(--c-blue-gray-800);
    font-size: 18px;
    ion-label {
      margin-top: 14px;
      margin-bottom: 14px;
      font-weight: 500;
    }
    ion-icon {
      font-size: 28px;
    }
    .icon {
      font-size: 30px;
    }
  }
}
</style>
