import type { UIMessage } from 'ai'
import type { OpenAiCompatibleChatSettings } from './openai-compatible-chat-transport'
import { Chat } from '@ai-sdk/vue'
import { computed, reactive, ref } from 'vue'
import { createScopedStorageKey } from '@/shared/lib/user-scope'
import { OpenAiCompatibleChatTransport } from './openai-compatible-chat-transport'

const AI_CHAT_SETTINGS_STORAGE_KEY = 'ai-chat-settings'
const DEFAULT_MODEL = 'gpt-4.1-mini'

const settingsState = reactive<OpenAiCompatibleChatSettings>({
  apiKey: '',
  baseUrl: '',
  model: DEFAULT_MODEL,
})
const hasHydrated = ref(false)
const showSettings = ref(false)

const chat = new Chat<UIMessage>({
  transport: new OpenAiCompatibleChatTransport({
    resolveSettings: () => settingsState,
  }),
})

function getStorageKey() {
  return createScopedStorageKey(AI_CHAT_SETTINGS_STORAGE_KEY)
}

function getEnvDefaults(): OpenAiCompatibleChatSettings {
  return {
    baseUrl: import.meta.env.VITE_AI_CHAT_BASE_URL?.trim() || '',
    apiKey: import.meta.env.VITE_AI_CHAT_API_KEY?.trim() || '',
    model: import.meta.env.VITE_AI_CHAT_MODEL?.trim() || DEFAULT_MODEL,
  }
}

function normalizeSettings(settings: Partial<OpenAiCompatibleChatSettings>): OpenAiCompatibleChatSettings {
  return {
    apiKey: settings.apiKey?.trim() || '',
    baseUrl: settings.baseUrl?.trim() || '',
    model: settings.model?.trim() || DEFAULT_MODEL,
  }
}

function hydrateSettings() {
  if (hasHydrated.value) {
    return
  }

  const envDefaults = getEnvDefaults()
  Object.assign(settingsState, envDefaults)

  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(getStorageKey())
    if (stored) {
      try {
        Object.assign(settingsState, normalizeSettings(JSON.parse(stored)))
      }
      catch {
        localStorage.removeItem(getStorageKey())
      }
    }
  }

  hasHydrated.value = true
}

function persistSettings() {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(getStorageKey(), JSON.stringify(settingsState))
}

function saveSettings(nextSettings: Partial<OpenAiCompatibleChatSettings>) {
  hydrateSettings()
  Object.assign(settingsState, normalizeSettings({
    ...settingsState,
    ...nextSettings,
  }))
  persistSettings()
  showSettings.value = false
}

function resetSettings() {
  const envDefaults = getEnvDefaults()
  Object.assign(settingsState, envDefaults)

  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(getStorageKey())
  }
}

function clearConversation() {
  chat.messages = []
  chat.clearError()
}

const hasConfiguredProvider = computed(() => {
  hydrateSettings()
  return !!settingsState.baseUrl && !!settingsState.apiKey && !!settingsState.model
})

const isBusy = computed(() => chat.status === 'submitted' || chat.status === 'streaming')

async function sendMessage(text: string) {
  hydrateSettings()

  const content = text.trim()
  if (!content) {
    return false
  }

  if (!hasConfiguredProvider.value) {
    showSettings.value = true
    return false
  }

  chat.clearError()
  void chat.sendMessage({ text: content }).catch(() => {})
  return true
}

export function useAiChat() {
  hydrateSettings()

  return {
    chat,
    clearConversation,
    hasConfiguredProvider,
    isBusy,
    openSettings: () => {
      showSettings.value = true
    },
    resetSettings,
    saveSettings,
    sendMessage,
    settings: settingsState,
    showSettings,
  }
}
