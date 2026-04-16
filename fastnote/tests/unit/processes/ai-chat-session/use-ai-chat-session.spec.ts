import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useAiChatSession', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('persists pending confirmation state and preview results across module reload', async () => {
    const previewResults = [{
      ok: true,
      code: 'confirmation_required',
      message: null,
      preview: {
        title: '准备删除备忘录',
        summary: '将软删除备忘录 note-1',
        affectedNoteIds: ['note-1'],
      },
      requiresConfirmation: true,
      affectedNoteIds: ['note-1'],
    }]

    const firstExecuteToolCalls = vi.fn(async () => previewResults)
    const firstModule = await import('@/processes/ai-chat-session/model/use-ai-chat-session')
    const firstSession = firstModule.useAiChatSession({
      executeToolCalls: firstExecuteToolCalls,
    })

    await firstSession.submitToolCalls([{
      tool: 'delete_note',
      payload: {
        noteId: 'note-1',
      },
    }])

    expect(firstSession.hasPendingConfirmation.value).toBe(true)
    expect(firstSession.lastResults.value).toMatchObject(previewResults)

    vi.resetModules()

    const restoredExecuteToolCalls = vi.fn(async () => [])
    const restoredModule = await import('@/processes/ai-chat-session/model/use-ai-chat-session')
    const restoredSession = restoredModule.useAiChatSession({
      executeToolCalls: restoredExecuteToolCalls,
    })

    expect(restoredSession.hasPendingConfirmation.value).toBe(true)
    expect(restoredSession.pendingExecution.value?.calls).toEqual([{
      tool: 'delete_note',
      payload: {
        noteId: 'note-1',
      },
      dryRun: false,
      confirmed: false,
      requireConfirmation: false,
    }])
    expect(restoredSession.lastResults.value).toMatchObject(previewResults)
  })
})
