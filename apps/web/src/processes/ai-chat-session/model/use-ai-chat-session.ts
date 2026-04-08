import type { AiNoteToolCall, AiToolResult } from '@/shared/types'
import { computed, ref } from 'vue'
import { useAiNoteCommand } from '@/features/ai-note-command'

export interface AiChatPendingExecution {
  calls: AiNoteToolCall[]
  createdAt: number
}

export interface UseAiChatSessionOptions {
  executeToolCalls?: ReturnType<typeof useAiNoteCommand>['executeToolCalls']
}

function markCallsAsConfirmed(calls: AiNoteToolCall[]) {
  return calls.map(call => ({
    ...call,
    confirmed: true,
  }))
}

export function useAiChatSession(options: UseAiChatSessionOptions = {}) {
  const aiNoteCommand = options.executeToolCalls ? null : useAiNoteCommand()
  const executeToolCalls = options.executeToolCalls || aiNoteCommand!.executeToolCalls

  const pendingExecution = ref<AiChatPendingExecution | null>(null)
  const lastResults = ref<AiToolResult[]>([])

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
