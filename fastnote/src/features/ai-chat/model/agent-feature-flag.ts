const DISABLED_VALUES = new Set(['0', 'false', 'off', 'no'])

export function isAiChatAgentEnabled() {
  const rawValue = import.meta.env.VITE_AI_CHAT_AGENT_ENABLED

  if (typeof rawValue !== 'string') {
    return true
  }

  const normalized = rawValue.trim().toLowerCase()
  if (!normalized) {
    return true
  }

  return !DISABLED_VALUES.has(normalized)
}
