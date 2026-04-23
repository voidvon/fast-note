import { describe, expect, it } from 'vitest'
import {
  createAgentTask,
  restoreAgentTaskAfterReload,
  updateAgentTask,
} from '@/features/ai-chat/model/agent-task'

describe('restoreAgentTaskAfterReload', () => {
  it('keeps waiting confirmation tasks unchanged after reload', () => {
    const task = updateAgentTask(createAgentTask('删除 note-1'), {
      status: 'waiting_confirmation',
      terminationReason: 'waiting_confirmation',
    })

    const restored = restoreAgentTaskAfterReload(task)

    expect(restored).toBe(task)
  })

  it('turns executing tasks into interrupted tasks after reload', () => {
    const task = updateAgentTask(createAgentTask('读取 note-1 并总结'), {
      appendStep: {
        kind: 'tool_call',
        title: '模型请求执行本地工具',
        detail: 'get_note_detail',
      },
      status: 'executing',
      terminationReason: 'running',
    })

    const restored = restoreAgentTaskAfterReload(task)

    expect(restored.status).toBe('interrupted')
    expect(restored.terminationReason).toBe('restored')
    expect(restored.restoredFromReload).toBe(true)
    expect(restored.steps.at(-1)).toMatchObject({
      kind: 'interrupted',
      title: '页面刷新后任务已中断',
    })
  })

  it('keeps completed tasks unchanged after reload', () => {
    const task = updateAgentTask(createAgentTask('总结 note-1'), {
      status: 'completed',
      terminationReason: 'answered',
    })

    const restored = restoreAgentTaskAfterReload(task)

    expect(restored).toBe(task)
  })

  it('keeps route-mismatched waiting confirmation tasks resumable after reload', () => {
    const task = updateAgentTask(createAgentTask('读取 note-1'), {
      routeTargetSnapshot: {
        routePath: '/n/note-1',
        noteId: 'note-1',
        folderId: '',
        parentId: '',
        overlayMode: 'ai',
      },
      status: 'waiting_confirmation',
      terminationReason: 'waiting_confirmation',
    })

    const restored = restoreAgentTaskAfterReload(task)

    expect(restored.status).toBe('waiting_confirmation')
    expect(restored.requiresRelocation).toBe(false)
    expect(restored.steps).toHaveLength(task.steps.length)
  })
})
