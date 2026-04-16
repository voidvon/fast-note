import { describe, expect, it } from 'vitest'
import {
  createAgentTask,
  getAgentTaskConfirmationModeLabel,
  getAgentTaskRiskLabel,
  getAgentTaskStatusLabel,
  normalizeAgentTask,
  updateAgentTask,
} from '@/features/ai-chat/model/agent-task'

describe('agent task helpers', () => {
  it('creates a task with identifying status', () => {
    const task = createAgentTask('读取这条笔记并帮我重写')

    expect(task.status).toBe('identifying')
    expect(task.terminationReason).toBe('running')
    expect(task.riskLevel).toBe('none')
    expect(task.confirmationMode).toBe('none')
    expect(task.steps).toHaveLength(1)
    expect(task.steps[0]).toMatchObject({
      kind: 'task',
      title: '已接收任务请求',
    })
  })

  it('updates task status and appends steps', () => {
    const task = createAgentTask('删除 note-1')
    const updated = updateAgentTask(task, {
      appendStep: {
        kind: 'confirmation',
        title: '等待你确认执行',
        detail: '我已根据你的请求生成执行预览。',
      },
      confirmationMode: 'required',
      riskLevel: 'high',
      status: 'waiting_confirmation',
      terminationReason: 'waiting_confirmation',
    })

    expect(updated.status).toBe('waiting_confirmation')
    expect(updated.terminationReason).toBe('waiting_confirmation')
    expect(updated.riskLevel).toBe('high')
    expect(updated.confirmationMode).toBe('required')
    expect(updated.steps).toHaveLength(2)
    expect(updated.steps.at(-1)).toMatchObject({
      kind: 'confirmation',
      title: '等待你确认执行',
    })
  })

  it('normalizes persisted task and exposes status labels', () => {
    const task = createAgentTask('读取 note-1')
    const persisted = normalizeAgentTask(JSON.parse(JSON.stringify(task)))

    expect(persisted).not.toBeNull()
    expect(getAgentTaskStatusLabel('identifying')).toBe('理解中')
    expect(getAgentTaskStatusLabel('waiting_confirmation')).toBe('待确认')
    expect(getAgentTaskStatusLabel('completed')).toBe('已完成')
    expect(getAgentTaskRiskLabel('medium')).toBe('中风险')
    expect(getAgentTaskConfirmationModeLabel('direct')).toBe('可直接执行')
  })
})
