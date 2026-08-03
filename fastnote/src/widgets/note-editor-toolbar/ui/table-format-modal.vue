<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { f7ListItem as F7ListItem } from 'framework7-vue'
import Dropdown from '@/shared/ui/dropdown'
import { F7Icon, F7List } from '@/shared/ui/f7'
import Icon from '@/shared/ui/icon'
import { trashOutline } from '@/shared/ui/icons'

const props = withDefaults(defineProps<{
  isOpen: boolean
  editor: Editor
  targetEl: string
  verticalPosition?: 'auto' | 'bottom' | 'top'
}>(), {
  verticalPosition: 'auto',
})

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
  <Dropdown
    v-bind="$attrs"
    :is-open
    :target-el
    :vertical-position
    size="compact"
    class="table-format-popover"
    @did-dismiss="$emit('update:isOpen', false)"
  >
    <F7List class="app-dropdown__list table-format-modal-list" strong inset>
      <F7ListItem link :href="false" no-chevron title="插入表格" @click="onClick('insert-table')">
        <template #media>
          <Icon name="table" class="app-dropdown__icon" />
        </template>
      </F7ListItem>
      <F7ListItem link :href="false" no-chevron title="删除表格" text-color="red" @click="onClick('delete-table')">
        <template #media>
          <F7Icon :icon="trashOutline" class="app-dropdown__icon app-dropdown__icon--danger" />
        </template>
      </F7ListItem>
      <F7ListItem link :href="false" no-chevron title="插入列" @click="onClick('add-column-after')">
        <template #media>
          <Icon name="insert-right-column" class="app-dropdown__icon" />
        </template>
      </F7ListItem>
      <F7ListItem link :href="false" no-chevron title="删除列" text-color="red" @click="onClick('delete-column')">
        <template #media>
          <Icon name="remove-column" class="app-dropdown__icon app-dropdown__icon--danger" />
        </template>
      </F7ListItem>
      <F7ListItem link :href="false" no-chevron title="插入行" @click="onClick('add-row-after')">
        <template #media>
          <Icon name="insert-bottom-row" class="app-dropdown__icon" />
        </template>
      </F7ListItem>
      <F7ListItem link :href="false" no-chevron title="删除行" text-color="red" @click="onClick('delete-row')">
        <template #media>
          <Icon name="remove-row" class="app-dropdown__icon app-dropdown__icon--danger" />
        </template>
      </F7ListItem>
    </F7List>
  </Dropdown>
</template>
