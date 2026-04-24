import { describe, expect, it } from 'vitest'
import {
  extractVisibleAiAssistantText,
  mergeAssistantAnswer,
  summarizeExecutionResults,
  summarizePreviewResults,
} from '@/features/ai-chat/model/assistant-envelope'

describe('assistant message helpers', () => {
  it('keeps visible assistant text as plain prose', () => {
    expect(extractVisibleAiAssistantText('  我先读取这条备忘录。  ')).toBe('我先读取这条备忘录。')
  })

  it('formats preview and execution summaries', () => {
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
  })

  it('merges assistant prose with execution summaries', () => {
    expect(mergeAssistantAnswer('我来处理。', '本次操作执行结果如下：')).toBe('我来处理。\n\n本次操作执行结果如下：')
  })
})
