<script setup lang="ts">
import type { ChatMessageCardAction, ChatMessageCardItem } from '../model/message-card'
import { computed } from 'vue'

const props = defineProps<{
  item: ChatMessageCardItem
}>()

const emit = defineEmits<{
  action: [payload: ChatMessageCardAction]
}>()

const secondaryText = computed(() => {
  return [props.item.meta, props.item.description]
    .filter(Boolean)
    .join(' · ')
})

function handleAction() {
  if (!props.item.action) {
    return
  }

  emit('action', props.item.action)
}
</script>

<template>
  <li
    class="chat-message__card-item"
    :class="{ 'chat-message__card-item--actionable': !!item.action }"
    :role="item.action ? 'button' : undefined"
    :tabindex="item.action ? 0 : undefined"
    @click="handleAction"
    @keydown.enter.prevent="handleAction"
    @keydown.space.prevent="handleAction"
  >
    <div class="chat-message__card-item-main">
      <button
        v-if="item.action"
        type="button"
        class="chat-message__card-item-button"
        @click.stop="handleAction"
      >
        {{ item.title }}
      </button>
      <strong v-else class="chat-message__card-item-title">{{ item.title }}</strong>

      <div v-if="item.tags?.length" class="chat-message__card-tags">
        <span v-for="tag in item.tags" :key="tag" class="chat-message__card-tag">
          {{ tag }}
        </span>
      </div>
    </div>

    <p v-if="secondaryText" class="chat-message__card-item-secondary">
      {{ secondaryText }}
    </p>
  </li>
</template>

<style scoped lang="scss">
.chat-message__card-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
}

.chat-message__card-item--actionable {
  cursor: pointer;
}

.chat-message__card-item--actionable:focus-visible {
  outline: 2px solid rgba(125, 211, 252, 0.8);
  outline-offset: 2px;
}

.chat-message__card-item-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chat-message__card-item-title,
.chat-message__card-item-button {
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  color: #f5f5f7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-message__card-item-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #7dd3fc;
  cursor: pointer;
  text-align: left;
}

.chat-message__card-item-secondary {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #a1a1aa;
}

.chat-message__card-tags {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.chat-message__card-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(125, 211, 252, 0.12);
  color: #bae6fd;
  font-size: 11px;
}
</style>
