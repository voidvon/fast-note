<script setup lang="ts">
import type { ChatMessageBlock, ChatMessageCard, ChatMessageCardAction, ChatMessageCardItem } from '../model/message-card'
import { IonButton, IonIcon, IonItem, IonNote, IonSpinner } from '@ionic/vue'
import { checkmarkOutline, copyOutline } from 'ionicons/icons'
import { computed, onBeforeUnmount, ref } from 'vue'
import { copyText } from '@/shared/lib/clipboard'
import StreamMarkdown from '@/shared/ui/stream-markdown'

const props = withDefaults(defineProps<{
  blocks?: ChatMessageBlock[]
  cards?: ChatMessageCard[]
  content?: string
  label?: string
  pending?: boolean
  pendingDescription?: string
  pendingLabel?: string
  role: 'assistant' | 'user'
  statusDescription?: string
  statusLabel?: string
  statusLoading?: boolean
  streaming?: boolean
}>(), {
  blocks: () => [],
  cards: () => [],
  content: '',
  label: undefined,
  pending: false,
  pendingDescription: '',
  pendingLabel: '思考中',
  streaming: false,
  statusDescription: '',
  statusLabel: '',
  statusLoading: false,
})
const emit = defineEmits<{
  action: [payload: ChatMessageCardAction]
}>()

const resolvedLabel = computed(() => {
  if (props.label) {
    return props.label
  }

  return props.role === 'user' ? '你' : 'AI'
})

const resolvedBlocks = computed<ChatMessageBlock[]>(() => {
  if (props.blocks.length) {
    return props.blocks
  }

  const fallbackBlocks: ChatMessageBlock[] = []
  if (props.content.trim()) {
    fallbackBlocks.push({
      id: 'content',
      text: props.content,
      type: 'text',
    })
  }

  if (props.cards.length) {
    fallbackBlocks.push({
      cards: props.cards,
      id: 'cards',
      type: 'cards',
    })
  }

  return fallbackBlocks
})

const canCopy = computed(() => !props.pending && !!props.content.trim())
const hasCopied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (copiedTimer) {
    clearTimeout(copiedTimer)
    copiedTimer = null
  }
})

async function handleCopy() {
  if (!canCopy.value) {
    return
  }

  await copyText(props.content)
  hasCopied.value = true

  if (copiedTimer) {
    clearTimeout(copiedTimer)
  }

  copiedTimer = setTimeout(() => {
    hasCopied.value = false
    copiedTimer = null
  }, 1600)
}

function handleCardAction(action?: ChatMessageCardAction) {
  if (!action) {
    return
  }

  emit('action', action)
}

function handleCardItemClick(action?: ChatMessageCardAction) {
  handleCardAction(action)
}

function isCompactNoteItem(item: ChatMessageCardItem) {
  return item.layout === 'note-compact'
}

function isCardsBlock(block: ChatMessageBlock): block is Extract<ChatMessageBlock, { type: 'cards' }> {
  return block.type === 'cards'
}
</script>

<template>
  <IonItem
    lines="none"
    class="chat-message"
    :class="[
      role === 'user' ? 'chat-message--user' : 'chat-message--assistant',
      { 'chat-message--pending': pending },
    ]"
  >
    <div class="chat-message__container">
      <IonNote class="chat-message__role">
        {{ resolvedLabel }}
      </IonNote>

      <div class="chat-message__bubble">
        <div v-if="pending" class="chat-message__pending-state">
          <div class="chat-message__pending-main">
            <IonSpinner name="crescent" class="chat-message__spinner" />
            <span>{{ pendingLabel }}</span>
          </div>
          <p v-if="pendingDescription" class="chat-message__pending-description">
            {{ pendingDescription }}
          </p>
        </div>
        <template v-else>
          <template v-for="block in resolvedBlocks" :key="block.id">
            <StreamMarkdown
              v-if="block.type === 'text' && role === 'assistant'"
              :markdown="block.text"
              :streaming="streaming"
            />
            <div v-else-if="block.type === 'text'" class="chat-message__plain">
              {{ block.text }}
            </div>
            <div v-else-if="isCardsBlock(block) && block.cards.length" class="chat-message__cards">
              <section
                v-for="card in block.cards"
                :key="card.id"
                class="chat-message__card"
                :class="card.status ? `chat-message__card--${card.status}` : ''"
              >
                <div class="chat-message__card-head">
                  <strong class="chat-message__card-title">{{ card.title }}</strong>
                  <span v-if="card.status" class="chat-message__card-status">
                    {{ card.status === 'success' ? '已完成' : card.status === 'warning' ? '待处理' : card.status === 'error' ? '失败' : '信息' }}
                  </span>
                </div>

                <p v-if="card.description" class="chat-message__card-description">
                  {{ card.description }}
                </p>

                <ul v-if="card.items?.length" class="chat-message__card-list">
                  <li
                    v-for="item in card.items"
                    :key="item.id"
                    class="chat-message__card-item"
                    :class="{ 'chat-message__card-item--actionable': !!item.action }"
                    :role="item.action ? 'button' : undefined"
                    :tabindex="item.action ? 0 : undefined"
                    @click="handleCardItemClick(item.action)"
                    @keydown.enter.prevent="handleCardItemClick(item.action)"
                    @keydown.space.prevent="handleCardItemClick(item.action)"
                  >
                    <template v-if="isCompactNoteItem(item)">
                      <div class="chat-message__card-item-main chat-message__card-item-main--compact">
                        <span
                          v-if="item.action"
                          class="chat-message__card-item-button chat-message__card-item-button--compact"
                        >
                          {{ item.title }}
                        </span>
                        <strong v-else class="chat-message__card-item-title">{{ item.title }}</strong>
                      </div>
                      <p v-if="item.meta || item.description" class="chat-message__card-item-secondary">
                        <span v-if="item.meta" class="chat-message__card-item-meta chat-message__card-item-meta--compact">{{ item.meta }}</span>
                        <span v-if="item.description" class="chat-message__card-item-description chat-message__card-item-description--compact">{{ item.description }}</span>
                      </p>
                    </template>
                    <template v-else>
                      <div class="chat-message__card-item-main">
                        <span
                          v-if="item.action"
                          class="chat-message__card-item-button"
                        >
                          {{ item.title }}
                        </span>
                        <strong v-else class="chat-message__card-item-title">{{ item.title }}</strong>
                        <span v-if="item.meta" class="chat-message__card-item-meta">{{ item.meta }}</span>
                      </div>
                      <p v-if="item.description" class="chat-message__card-item-description">
                        {{ item.description }}
                      </p>
                    </template>
                    <div v-if="item.tags?.length && !isCompactNoteItem(item)" class="chat-message__card-tags">
                      <span v-for="tag in item.tags" :key="tag" class="chat-message__card-tag">
                        {{ tag }}
                      </span>
                    </div>
                  </li>
                </ul>

                <p v-if="card.footer" class="chat-message__card-footer">
                  {{ card.footer }}
                </p>
              </section>
            </div>
          </template>
        </template>

        <div v-if="statusLabel" class="chat-message__status-state">
          <div class="chat-message__status-main">
            <IonSpinner
              v-if="statusLoading"
              name="crescent"
              class="chat-message__spinner"
            />
            <span>{{ statusLabel }}</span>
          </div>
          <p v-if="statusDescription" class="chat-message__status-description">
            {{ statusDescription }}
          </p>
        </div>
      </div>

      <div v-if="canCopy" class="chat-message__actions">
        <IonButton
          fill="clear"
          size="small"
          class="chat-message__copy-button"
          :aria-label="hasCopied ? '已复制消息' : '复制消息'"
          @click="handleCopy"
        >
          <IonIcon :icon="hasCopied ? checkmarkOutline : copyOutline" />
          <span>{{ hasCopied ? '已复制' : '复制' }}</span>
        </IonButton>
      </div>
    </div>
  </IonItem>
</template>

<style scoped lang="scss">
.chat-message {
  --background: transparent;
  --border-width: 0;
  --inner-border-width: 0;
  --inner-padding-end: 0;
  --inner-padding-start: 0;
  --padding-start: 0;
  --padding-end: 0;
  --min-height: auto;
  align-items: flex-start;
}

.chat-message__container {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 6px;
}

.chat-message--user .chat-message__container {
  align-items: flex-end;
}

.chat-message__role {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: #8e8e93;
}

.chat-message__bubble {
  max-width: min(680px, 86%);
  padding: 12px 14px;
  border-radius: 18px;
  color: #f5f5f7;
  font-size: 14px;
  line-height: 1.65;
  word-break: break-word;
}

.chat-message__plain {
  white-space: pre-wrap;
}

.chat-message__cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.chat-message__cards + .stream-markdown {
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

.chat-message__card-title,
.chat-message__card-item-title {
  font-size: 13px;
  color: #f5f5f7;
}

.chat-message__card-item-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #7dd3fc;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  text-align: left;
}

.chat-message__card-status,
.chat-message__card-item-meta,
.chat-message__card-footer {
  font-size: 12px;
  color: #a1a1aa;
}

.chat-message__card-description,
.chat-message__card-item-description {
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
  padding-left: 0;
  list-style: none;
}

.chat-message__card-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.chat-message__card-item-main--compact {
  display: block;
}

.chat-message__card-item-button--compact,
.chat-message__card-item-main--compact .chat-message__card-item-title {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-message__card-item-secondary {
  display: flex;
  gap: 8px;
  min-width: 0;
  margin: 0;
  font-size: 12px;
  color: #a1a1aa;
  white-space: nowrap;
}

.chat-message__card-item-meta--compact {
  flex: 0 0 auto;
}

.chat-message__card-item-description--compact {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-message__card-tags {
  display: flex;
  flex-wrap: wrap;
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

.chat-message__actions {
  display: flex;
}

.chat-message--user .chat-message__actions {
  justify-content: flex-end;
}

.chat-message__copy-button {
  --color: #8e8e93;
  --padding-start: 6px;
  --padding-end: 6px;
  margin: 0;
  min-height: 24px;
  font-size: 12px;
  text-transform: none;
}

.chat-message__copy-button span {
  margin-left: 4px;
}

.chat-message__pending-state {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  color: #d4d4d8;
}

.chat-message__pending-main {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.chat-message__pending-description {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #a1a1aa;
  white-space: pre-wrap;
}

.chat-message__status-state {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-top: 12px;
  color: #d4d4d8;
}

.chat-message__status-main {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  line-height: 1.5;
}

.chat-message__status-description {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #a1a1aa;
  white-space: pre-wrap;
}

.chat-message__spinner {
  width: 16px;
  height: 16px;
  color: #7dd3fc;
}

.chat-message__bubble :deep(*) {
  min-width: 0;
}

.chat-message__bubble :deep(p) {
  margin: 0;
}

.chat-message__bubble :deep(p + p),
.chat-message__bubble :deep(p + ul),
.chat-message__bubble :deep(p + ol),
.chat-message__bubble :deep(p + pre),
.chat-message__bubble :deep(p + blockquote),
.chat-message__bubble :deep(ul + p),
.chat-message__bubble :deep(ol + p),
.chat-message__bubble :deep(pre + p),
.chat-message__bubble :deep(blockquote + p),
.chat-message__bubble :deep(ul + ul),
.chat-message__bubble :deep(ol + ol),
.chat-message__bubble :deep(pre + pre),
.chat-message__bubble :deep(blockquote + blockquote),
.chat-message__bubble :deep(table + p),
.chat-message__bubble :deep(p + table) {
  margin-top: 0.75em;
}

.chat-message__bubble :deep(ul),
.chat-message__bubble :deep(ol) {
  margin: 0;
}

.chat-message__bubble :deep(li + li) {
  margin-top: 0.3em;
}

.chat-message__bubble :deep(a) {
  color: #7dd3fc;
}

.chat-message__bubble :deep(strong) {
  font-weight: 700;
}

.chat-message__bubble :deep(em) {
  font-style: italic;
}

.chat-message__bubble :deep(code) {
  padding: 0.15em 0.4em;
  border-radius: 8px;
  background: rgba(12, 12, 14, 0.5);
  font-size: 0.92em;
}

.chat-message__bubble :deep(pre) {
  overflow-x: auto;
  margin: 0;
  padding: 12px;
  border-radius: 14px;
  background: rgba(12, 12, 14, 0.56);
}

.chat-message__bubble :deep(pre code) {
  padding: 0;
  background: transparent;
}

.chat-message__bubble :deep(blockquote) {
  margin: 0;
  padding-left: 12px;
  border-left: 3px solid rgba(125, 211, 252, 0.35);
  color: #d4d4d8;
}

.chat-message__bubble :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.chat-message__bubble :deep(th),
.chat-message__bubble :deep(td) {
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-align: left;
}

.chat-message__bubble :deep(th) {
  color: #f5f5f7;
  background: rgba(255, 255, 255, 0.06);
}
</style>
