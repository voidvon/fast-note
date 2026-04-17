import { describe, expect, it } from 'vitest'
import {
  extractVisibleAiAssistantText,
  isLikelyPartialAiAssistantToolEnvelope,
  mergeAssistantAnswer,
  parseAiAssistantToolEnvelope,
  summarizeExecutionResults,
  summarizePreviewResults,
} from '@/features/ai-chat/model/assistant-envelope'

describe('assistant envelope helpers', () => {
  it('parses raw tool envelope json', () => {
    const envelope = parseAiAssistantToolEnvelope(JSON.stringify({
      mode: 'tool_calls',
      answer: '我来处理。',
      toolCalls: [{
        tool: 'search_notes',
        payload: {
          query: '周报',
        },
      }],
    }))

    expect(envelope).toEqual({
      mode: 'tool_calls',
      answer: '我来处理。',
      toolCalls: [{
        tool: 'search_notes',
        payload: {
          query: '周报',
        },
      }],
    })
  })

  it('parses fenced json and formats summaries', () => {
    const envelope = parseAiAssistantToolEnvelope(`
\`\`\`json
{"toolCalls":[{"tool":"delete_note","payload":{"noteId":"note-1"}}]}
\`\`\`
    `)

    expect(envelope?.toolCalls).toHaveLength(1)
    expect(summarizePreviewResults([{
      ok: true,
      code: 'confirmation_required',
      message: null,
      preview: {
        title: '准备删除备忘录',
        summary: '将软删除备忘录 note-1',
        affectedNoteIds: ['note-1'],
      },
      requiresConfirmation: true,
    }])).toContain('请确认是否继续执行。')

    expect(summarizeExecutionResults([{
      ok: false,
      code: 'pin_required',
      message: '请先创建全局 PIN',
      preview: {
        title: '准备开启备忘录锁',
        summary: '开启备忘录 note-1 的锁定状态',
        affectedNoteIds: ['note-1'],
      },
      humanActionRequired: true,
    }])).toContain('需要人工完成后续步骤')

    expect(mergeAssistantAnswer('我来处理。', '本次操作执行结果如下：')).toContain('我来处理。')
  })

  it('parses mixed prose and embedded tool envelope json', () => {
    const rawText = `
我还不能直接知道总数，需要先读取你的备忘录列表。

{"mode":"tool_calls","answer":"我还不能直接知道总数，需要先读取你的备忘录列表。","toolCalls":[{"tool":"search_notes","payload":{"query":"*"}}]}
    `

    expect(parseAiAssistantToolEnvelope(rawText)).toEqual({
      mode: 'tool_calls',
      answer: '我还不能直接知道总数，需要先读取你的备忘录列表。',
      toolCalls: [{
        tool: 'search_notes',
        payload: {
          query: '*',
        },
      }],
    })

    expect(extractVisibleAiAssistantText(rawText)).toBe('我还不能直接知道总数，需要先读取你的备忘录列表。')
  })

  it('hides a partial embedded tool envelope suffix while streaming', () => {
    const partial = `
我还不能直接知道总数，需要先读取你的备忘录列表。

{"mode":"tool_calls","answer":"先帮你统计备忘录总数。","toolCalls":[{"tool":"search_notes"
    `

    expect(parseAiAssistantToolEnvelope(partial)).toBeNull()
    expect(isLikelyPartialAiAssistantToolEnvelope(partial)).toBe(true)
    expect(extractVisibleAiAssistantText(partial)).toBe('我还不能直接知道总数，需要先读取你的备忘录列表。')
  })

  it('shows the answer from a partial pure json envelope', () => {
    const partial = '{"mode":"tool_calls","answer":"已整理好润色版本，准备直接写回这篇备忘录。","toolCalls":[{"tool":"update_note"'

    expect(parseAiAssistantToolEnvelope(partial)).toBeNull()
    expect(isLikelyPartialAiAssistantToolEnvelope(partial)).toBe(true)
    expect(extractVisibleAiAssistantText(partial)).toBe('已整理好润色版本，准备直接写回这篇备忘录。')
  })
})
