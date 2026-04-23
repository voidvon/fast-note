<script setup lang="ts">
import type { ChatMessageCard, ChatMessageCardAction } from '../model/message-card'
import { computed } from 'vue'
import ChatMessageCardItem from './chat-message-card-item.vue'

const props = defineProps<{
  cards: ChatMessageCard[]
  selectedItemId?: string
}>()

const emit = defineEmits<{
  action: [payload: ChatMessageCardAction]
}>()

const statusLabelMap = {
  error: '失败',
  info: '信息',
  success: '已完成',
  warning: '待处理',
} as const

const visibleCards = computed(() => props.cards.filter(card => !!card))

function resolveStatusLabel(status?: ChatMessageCard['status']) {
  return status ? statusLabelMap[status] : ''
}

function handleItemAction(action: ChatMessageCardAction) {
  emit('action', action)
}
</script>

<template>
  <div v-if="visibleCards.length" class="chat-message__cards">
    <section
      v-for="card in visibleCards"
      :key="card.id"
      class="chat-message__card"
      :class="card.status ? `chat-message__card--${card.status}` : ''"
    >
      <div class="chat-message__card-head">
        <strong class="chat-message__card-title">{{ card.title }}</strong>
        <span v-if="card.status" class="chat-message__card-status">
          {{ resolveStatusLabel(card.status) }}
        </span>
      </div>

      <p v-if="card.description" class="chat-message__card-description">
        {{ card.description }}
      </p>

      <ul v-if="card.items?.length" class="chat-message__card-list">
        <ChatMessageCardItem
          v-for="item in card.items"
          :key="item.id"
          :item="item"
          :selected="item.id === selectedItemId"
          @action="handleItemAction"
        />
      </ul>

      <p v-if="card.footer" class="chat-message__card-footer">
        {{ card.footer }}
      </p>
    </section>
  </div>
</template>

<style scoped lang="scss">
.chat-message__cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.chat-message__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(7, 10, 18, 0.36);
}

.chat-message__card--success {
  border-color: rgba(74, 222, 128, 0.22);
}

.chat-message__card--warning {
  border-color: rgba(250, 204, 21, 0.24);
}

.chat-message__card--error {
  border-color: rgba(248, 113, 113, 0.24);
}

.chat-message__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chat-message__card-title {
  font-size: 13px;
  color: #f5f5f7;
}

.chat-message__card-status,
.chat-message__card-footer {
  font-size: 12px;
  color: #a1a1aa;
}

.chat-message__card-description {
  margin: 0;
  font-size: 12px;
  color: #d4d4d8;
}

.chat-message__card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
