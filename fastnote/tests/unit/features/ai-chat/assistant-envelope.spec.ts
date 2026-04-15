import { describe, expect, it } from 'vitest'
import {
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
})
