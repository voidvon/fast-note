import { describe, expect, it } from 'vitest'
import { applyAgentMutationPolicy } from '@/features/ai-chat/model/mutation-policy'

describe('applyAgentMutationPolicy', () => {
  const requestContext = {
    resolvedTarget: {
      source: 'message_note_url' as const,
      note: {
        id: 'note-1',
        title: '周报',
        summary: '待整理',
        parentId: '',
        updated: '2026-04-16 10:00:00',
        isDeleted: false,
        isLocked: false,
      },
    },
  }

  it('forces delete operations into confirmation mode', () => {
    const policy = applyAgentMutationPolicy({
      tool: 'delete_note',
      payload: {
        noteId: 'note-1',
      },
    }, '删除这条笔记', requestContext)

    expect(policy.riskLevel).toBe('high')
    expect(policy.confirmationMode).toBe('required')
    expect(policy.call.requireConfirmation).toBe(true)
  })

  it('allows explicit direct rewrite tool calls to write back immediately', () => {
    const policy = applyAgentMutationPolicy({
      tool: 'update_note',
      confirmed: true,
      requireConfirmation: false,
      payload: {
        noteId: 'note-1',
        contentHtml: '<p>这是改写后的正文。</p>',
      },
    }, 'rewrite this note', requestContext)

    expect(policy.riskLevel).toBe('low')
    expect(policy.confirmationMode).toBe('direct')
    expect(policy.call.requireConfirmation).toBe(false)
    expect(policy.call.confirmed).toBe(true)
    expect(policy.rewriteSuggestion).toContain('这是改写后的正文')
  })

  it('keeps ambiguous rewrites in confirmation mode', () => {
    const policy = applyAgentMutationPolicy({
      tool: 'update_note',
      payload: {
        noteId: 'note-1',
        contentHtml: '<p>这是建议版本。</p>',
      },
    }, 'rewrite this note', requestContext)

    expect(policy.riskLevel).toBe('medium')
    expect(policy.confirmationMode).toBe('required')
    expect(policy.call.requireConfirmation).toBe(true)
  })
})
