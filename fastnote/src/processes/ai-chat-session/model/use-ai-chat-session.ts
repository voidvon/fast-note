import type { AiNoteToolCall, AiToolResult } from '@/shared/types'
import { computed, ref, watch } from 'vue'
import { useAiNoteCommand } from '@/features/ai-note-command/model/use-ai-note-command'
import { createScopedStorageKey } from '@/shared/lib/user-scope'

const AI_CHAT_SESSION_STORAGE_KEY = 'ai-chat-session'

export interface AiChatPendingExecution {
  calls: AiNoteToolCall[]
  createdAt: number
}

export interface UseAiChatSessionOptions {
  executeToolCalls?: ReturnType<typeof useAiNoteCommand>['executeToolCalls']
}

interface PersistedAiChatSessionState {
  lastResults: AiToolResult[]
  pendingExecution: AiChatPendingExecution | null
}

const pendingExecution = ref<AiChatPendingExecution | null>(null)
const lastResults = ref<AiToolResult[]>([])
const hasHydrated = ref(false)

function markCallsAsConfirmed(calls: AiNoteToolCall[]) {
  return calls.map(call => ({
    ...call,
    confirmed: true,
  }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getStorageKey() {
  return createScopedStorageKey(AI_CHAT_SESSION_STORAGE_KEY)
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function normalizeAiToolPreview(value: unknown) {
  if (!isRecord(value) || typeof value.title !== 'string' || typeof value.summary !== 'string') {
    return undefined
  }

  return {
    title: value.title,
    summary: value.summary,
    affectedNoteIds: normalizeStringArray(value.affectedNoteIds),
  }
}

function normalizeAiToolResult(value: unknown): AiToolResult | null {
  if (!isRecord(value) || typeof value.ok !== 'boolean' || typeof value.code !== 'string') {
    return null
  }

  return {
    ok: value.ok,
    code: value.code,
    message: typeof value.message === 'string' ? value.message : value.message === null ? null : null,
    data: value.data,
    preview: normalizeAiToolPreview(value.preview),
    requiresConfirmation: value.requiresConfirmation === true,
    affectedNoteIds: normalizeStringArray(value.affectedNoteIds),
    syncQueued: value.syncQueued === true,
    humanActionRequired: value.humanActionRequired === true,
  }
}

function normalizeToolCall(value: unknown): AiNoteToolCall | null {
  if (!isRecord(value) || typeof value.tool !== 'string' || !isRecord(value.payload)) {
    return null
  }

  return {
    tool: value.tool as AiNoteToolCall['tool'],
    payload: value.payload as AiNoteToolCall['payload'],
    dryRun: value.dryRun === true,
    confirmed: value.confirmed === true,
    requireConfirmation: value.requireConfirmation === true,
  } as AiNoteToolCall
}

function normalizePendingExecution(value: unknown): AiChatPendingExecution | null {
  if (!isRecord(value) || !Array.isArray(value.calls) || typeof value.createdAt !== 'number') {
    return null
  }

  const calls = value.calls
    .map(call => normalizeToolCall(call))
    .filter((call): call is AiNoteToolCall => !!call)

  if (!calls.length) {
    return null
  }

  return {
    calls,
    createdAt: value.createdAt,
  }
}

function hydrateSessionState() {
  if (hasHydrated.value || typeof localStorage === 'undefined') {
    hasHydrated.value = true
    return
  }

  const stored = localStorage.getItem(getStorageKey())
  if (!stored) {
    hasHydrated.value = true
    return
  }

  try {
    const parsed = JSON.parse(stored) as PersistedAiChatSessionState
    pendingExecution.value = normalizePendingExecution(parsed.pendingExecution)
    lastResults.value = Array.isArray(parsed.lastResults)
      ? parsed.lastResults
          .map(result => normalizeAiToolResult(result))
          .filter((result): result is AiToolResult => !!result)
      : []
  }
  catch {
    localStorage.removeItem(getStorageKey())
  }

  hasHydrated.value = true
}

function persistSessionState() {
  if (typeof localStorage === 'undefined') {
    return
  }

  if (!pendingExecution.value && !lastResults.value.length) {
    localStorage.removeItem(getStorageKey())
    return
  }

  localStorage.setItem(getStorageKey(), JSON.stringify({
    pendingExecution: pendingExecution.value,
    lastResults: lastResults.value,
  } satisfies PersistedAiChatSessionState))
}

export function useAiChatSession(options: UseAiChatSessionOptions = {}) {
  hydrateSessionState()

  const aiNoteCommand = options.executeToolCalls ? null : useAiNoteCommand()
  const executeToolCalls = options.executeToolCalls || aiNoteCommand!.executeToolCalls

  const hasPendingConfirmation = computed(() => !!pendingExecution.value)

  async function submitToolCalls(calls: AiNoteToolCall[]) {
    const previewResults = await executeToolCalls(calls)
    const needsConfirmation = previewResults.some(result => result.requiresConfirmation)

    if (needsConfirmation) {
      pendingExecution.value = {
        calls,
        createdAt: Date.now(),
      }
      lastResults.value = previewResults
      return previewResults
    }

    pendingExecution.value = null
    lastResults.value = previewResults
    return previewResults
  }

  async function confirmPendingExecution() {
    if (!pendingExecution.value) {
      return [] as AiToolResult[]
    }

    const calls = markCallsAsConfirmed(pendingExecution.value.calls)
    pendingExecution.value = null
    const results = await executeToolCalls(calls)
    lastResults.value = results
    return results
  }

  function cancelPendingExecution() {
    pendingExecution.value = null
  }

  return {
    cancelPendingExecution,
    confirmPendingExecution,
    hasPendingConfirmation,
    lastResults,
    pendingExecution,
    submitToolCalls,
  }
}

watch(() => ({
  pendingExecution: pendingExecution.value,
  lastResults: lastResults.value,
}), () => {
  if (!hasHydrated.value) {
    return
  }

  persistSessionState()
}, { deep: true })
