<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { onMounted, ref } from 'vue'
import { F7Icon, F7Item, F7Label, F7List, F7Modal } from '@/shared/ui/f7'
import Icon from '@/shared/ui/icon'
import { trashOutline } from '@/shared/ui/icons'

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
  <F7Modal
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
      <F7List class="table-format-modal-list" inset>
        <F7Item @click="onClick('insert-table')">
          <F7Label>插入表格</F7Label>
          <template #after>
            <Icon name="table" />
          </template>
        </F7Item>
        <F7Item @click="onClick('delete-table')">
          <F7Label style="color: var(--danger)">
            删除表格
          </F7Label>
          <template #after>
            <F7Icon :icon="trashOutline" color="danger" />
          </template>
        </F7Item>
      </F7List>
      <F7List class="table-format-modal-list" inset>
        <F7Item @click="onClick('add-column-after')">
          <F7Label>插入列</F7Label>
          <template #after>
            <Icon name="insert-right-column" />
          </template>
        </F7Item>
        <F7Item @click="onClick('delete-column')">
          <F7Label style="color: var(--danger)">
            删除列
          </F7Label>
          <template #after>
            <Icon name="remove-column" color="danger" />
          </template>
        </F7Item>
      </F7List>
      <F7List class="table-format-modal-list" inset>
        <F7Item @click="onClick('add-row-after')">
          <F7Label>插入行</F7Label>
          <template #after>
            <Icon name="insert-bottom-row" />
          </template>
        </F7Item>
        <F7Item @click="onClick('delete-row')">
          <F7Label style="color: var(--danger)">
            删除行
          </F7Label>
          <template #after>
            <Icon name="remove-row" color="danger" />
          </template>
        </F7Item>
      </F7List>
    </div>
  </F7Modal>
</template>

<style lang="scss">
.table-format-modal {
  --background: var(--c-modal-background);
}
.table-format-modal-list {
  .app-list-item {
    --background: var(--c-list-background);
    --color: var(--c-text-primary);
    font-size: 18px;
    .app-label {
      margin-top: 14px;
      margin-bottom: 14px;
      font-weight: 500;
    }
    .app-icon {
      font-size: 28px;
    }
    .icon {
      font-size: 30px;
    }
  }
}
</style>
