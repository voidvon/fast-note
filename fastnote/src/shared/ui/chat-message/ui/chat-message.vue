<script setup lang="ts">
import type { ChatMessageBlock, ChatMessageCard, ChatMessageCardAction } from '../model/message-card'
import { computed, onBeforeUnmount, ref } from 'vue'
import { copyText } from '@/shared/lib/clipboard'
import { F7Button, F7Icon, F7Item, F7Note, F7Spinner } from '@/shared/ui/f7'
import { checkmarkOutline, copyOutline } from '@/shared/ui/icons'
import StreamMarkdown from '@/shared/ui/stream-markdown'
import ChatMessageCards from './chat-message-cards.vue'

const props = withDefaults(defineProps<{
  blocks?: ChatMessageBlock[]
  cards?: ChatMessageCard[]
  content?: string
  label?: string
  pending?: boolean
  pendingDescription?: string
  pendingLabel?: string
  role: 'assistant' | 'user'
  selectedItemId?: string
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

function isCardsBlock(block: ChatMessageBlock): block is Extract<ChatMessageBlock, { type: 'cards' }> {
  return block.type === 'cards'
}
</script>

<template>
  <F7Item
    lines="none"
    class="chat-message"
    :class="[
      role === 'user' ? 'chat-message--user' : 'chat-message--assistant',
      { 'chat-message--pending': pending },
    ]"
  >
    <div class="chat-message__container">
      <F7Note class="chat-message__role">
        {{ resolvedLabel }}
      </F7Note>

      <div class="chat-message__bubble">
        <div v-if="pending" class="chat-message__pending-state">
          <div class="chat-message__pending-main">
            <F7Spinner name="crescent" class="chat-message__spinner" />
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
            <ChatMessageCards
              v-else-if="isCardsBlock(block) && block.cards.length"
              :cards="block.cards"
              :selected-item-id="selectedItemId"
              @action="handleCardItemClick"
            />
          </template>
        </template>

        <div v-if="statusLabel" class="chat-message__status-state">
          <div class="chat-message__status-main">
            <F7Spinner
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
        <F7Button
          fill="clear"
          size="small"
          class="chat-message__copy-button"
          :aria-label="hasCopied ? '已复制消息' : '复制消息'"
          @click="handleCopy"
        >
          <F7Icon :icon="hasCopied ? checkmarkOutline : copyOutline" />
          <span>{{ hasCopied ? '已复制' : '复制' }}</span>
        </F7Button>
      </div>
    </div>
  </F7Item>
</template>

<style lang="scss">
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

  &__container {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 6px;
  }

  &--user {
    .chat-message__container {
      align-items: flex-end;
    }

    .chat-message__bubble {
      background: var(--f7-theme-color);
      color: #000;
    }

    .chat-message__actions {
      justify-content: flex-end;
    }
  }

  &--assistant {
    .chat-message__bubble {
      background: var(--c-list-group-background);
      color: var(--c-text-primary);
    }
  }

  &__role {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--c-text-secondary);
  }

  &__bubble {
    max-width: min(680px, 86%);
    padding: 12px 14px;
    border-radius: 18px;
    font-size: 14px;
    line-height: 1.65;
    word-break: break-word;

    * {
      min-width: 0;
    }

    p {
      margin: 0;
    }

    p + p,
    p + ul,
    p + ol,
    p + pre,
    p + blockquote,
    ul + p,
    ol + p,
    pre + p,
    blockquote + p,
    ul + ul,
    ol + ol,
    pre + pre,
    blockquote + blockquote,
    table + p,
    p + table {
      margin-top: 0.75em;
    }

    ul,
    ol {
      margin: 0;
    }

    li + li {
      margin-top: 0.3em;
    }

    a {
      color: var(--primary);
    }

    strong {
      font-weight: 700;
    }

    em {
      font-style: italic;
    }

    code {
      padding: 0.15em 0.4em;
      border-radius: 8px;
      background: var(--c-code-inline-background);
      color: var(--c-code-text);
      font-size: 0.92em;
    }

    pre {
      overflow-x: auto;
      margin: 0;
      padding: 12px;
      border-radius: 14px;
      background: var(--c-code-block-background);

      code {
        padding: 0;
        background: transparent;
      }
    }

    blockquote {
      margin: 0;
      padding-left: 12px;
      border-left: 3px solid var(--primary);
      color: var(--c-text-secondary);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    th,
    td {
      padding: 8px 10px;
      border: 1px solid var(--c-border);
      text-align: left;
    }

    th {
      color: var(--c-text-primary);
      background: rgba(255, 255, 255, 0.06);
    }
  }

  &__plain {
    white-space: pre-wrap;
  }

  &__cards + .stream-markdown {
    margin-top: 12px;
  }

  &__actions {
    display: flex;
  }

  &__copy-button {
    --color: var(--c-text-secondary);
    --padding-start: 6px;
    --padding-end: 6px;
    margin: 0;
    min-height: 24px;
    font-size: 12px;
    text-transform: none;

    span {
      margin-left: 4px;
    }
  }

  &__pending-state {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    color: var(--c-text-secondary);
  }

  &__pending-main {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  &__pending-description {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--c-text-secondary);
    white-space: pre-wrap;
  }

  &__status-state {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    margin-top: 12px;
    color: var(--c-text-secondary);
  }

  &__status-main {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    line-height: 1.5;
  }

  &__status-description {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--c-text-secondary);
    white-space: pre-wrap;
  }

  &__spinner {
    width: 16px;
    height: 16px;
    color: var(--f7-theme-color);
  }
}
</style>
