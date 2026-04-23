import { nanoid } from 'nanoid'
import type { AiAgentConfirmationMode, AiAgentMutationRiskLevel } from './mutation-policy'
import type { AiAgentRouteTargetSnapshot } from './route-target-snapshot'
import type { AiChatRequestContext } from './request-context'
import { normalizeAiChatRequestContext } from './request-context'

export type AiAgentTaskStatus =
  | 'identifying'
  | 'executing'
  | 'waiting_confirmation'
  | 'completed'
  | 'failed'
  | 'interrupted'
  | 'cancelled'

export type AiAgentTaskTerminationReason =
  | 'running'
  | 'answered'
  | 'waiting_confirmation'
  | 'tool_failed'
  | 'request_failed'
  | 'max_depth'
  | 'restored'
  | 'cancelled'

export type AiAgentTaskStepKind =
  | 'task'
  | 'tool_call'
  | 'tool_result'
  | 'answer'
  | 'failure'
  | 'interrupted'
  | 'confirmation'

export type AiAgentTaskStepStatus = 'completed' | 'current' | 'failed'

export interface AiAgentTaskStep {
  createdAt: number
  detail: string
  id: string
  kind: AiAgentTaskStepKind
  status: AiAgentTaskStepStatus
  title: string
}

export interface AiAgentTask {
  confirmationMode: AiAgentConfirmationMode
  createdAt: number
  id: string
  input: string
  lastError: string
  lastRewriteSuggestion: string
  lastResponseText: string
  riskLevel: AiAgentMutationRiskLevel
  restoredFromReload: boolean
  routeTargetSnapshot: AiAgentRouteTargetSnapshot | null
  taskContextSnapshot: AiChatRequestContext | null
  requiresRelocation: boolean
  status: AiAgentTaskStatus
  steps: AiAgentTaskStep[]
  terminationReason: AiAgentTaskTerminationReason
  updatedAt: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTaskStatus(value: unknown): value is AiAgentTaskStatus {
  return value === 'identifying'
    || value === 'executing'
    || value === 'waiting_confirmation'
    || value === 'completed'
    || value === 'failed'
    || value === 'interrupted'
    || value === 'cancelled'
}

function isTerminationReason(value: unknown): value is AiAgentTaskTerminationReason {
  return value === 'running'
    || value === 'answered'
    || value === 'waiting_confirmation'
    || value === 'tool_failed'
    || value === 'request_failed'
    || value === 'max_depth'
    || value === 'restored'
    || value === 'cancelled'
}

function isRiskLevel(value: unknown): value is AiAgentMutationRiskLevel {
  return value === 'none'
    || value === 'low'
    || value === 'medium'
    || value === 'high'
}

function isConfirmationMode(value: unknown): value is AiAgentConfirmationMode {
  return value === 'none'
    || value === 'direct'
    || value === 'required'
}

function isStepKind(value: unknown): value is AiAgentTaskStepKind {
  return value === 'task'
    || value === 'tool_call'
    || value === 'tool_result'
    || value === 'answer'
    || value === 'failure'
    || value === 'interrupted'
    || value === 'confirmation'
}

function isStepStatus(value: unknown): value is AiAgentTaskStepStatus {
  return value === 'completed' || value === 'current' || value === 'failed'
}

function normalizeRouteTargetSnapshot(value: unknown): AiAgentRouteTargetSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<AiAgentRouteTargetSnapshot>
  if (typeof candidate.routePath !== 'string') {
    return null
  }

  return {
    folderId: typeof candidate.folderId === 'string' ? candidate.folderId : '',
    noteId: typeof candidate.noteId === 'string' ? candidate.noteId : '',
    overlayMode: candidate.overlayMode === 'ai' ? 'ai' : 'ai',
    parentId: typeof candidate.parentId === 'string' ? candidate.parentId : '',
    routePath: candidate.routePath,
  }
}

function normalizeTaskStep(value: unknown): AiAgentTaskStep | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') {
    return null
  }

  return {
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    detail: typeof value.detail === 'string' ? value.detail : '',
    id: value.id,
    kind: isStepKind(value.kind) ? value.kind : 'task',
    status: isStepStatus(value.status) ? value.status : 'completed',
    title: value.title,
  }
}

function createTaskStep(input: {
  detail?: string
  kind: AiAgentTaskStepKind
  status?: AiAgentTaskStepStatus
  title: string
}): AiAgentTaskStep {
  return {
    createdAt: Date.now(),
    detail: input.detail?.trim() || '',
    id: nanoid(),
    kind: input.kind,
    status: input.status || 'completed',
    title: input.title.trim(),
  }
}

export function createAgentTask(input: string, taskContextSnapshot: AiChatRequestContext | null = null): AiAgentTask {
  const createdAt = Date.now()

  return {
    confirmationMode: 'none',
    createdAt,
    id: nanoid(),
    input: input.trim(),
    lastError: '',
    lastRewriteSuggestion: '',
    lastResponseText: '',
    riskLevel: 'none',
    restoredFromReload: false,
    routeTargetSnapshot: null,
    taskContextSnapshot,
    requiresRelocation: false,
    status: 'identifying',
    steps: [
      createTaskStep({
        kind: 'task',
        title: '已接收任务请求',
        detail: input.trim(),
      }),
    ],
    terminationReason: 'running',
    updatedAt: createdAt,
  }
}

export function appendAgentTaskStep(task: AiAgentTask, input: {
  detail?: string
  kind: AiAgentTaskStepKind
  status?: AiAgentTaskStepStatus
  title: string
}) {
  return {
    ...task,
    steps: task.steps.concat(createTaskStep(input)),
    updatedAt: Date.now(),
  }
}

export function updateAgentTask(task: AiAgentTask, updates: Partial<Omit<AiAgentTask, 'id' | 'createdAt' | 'steps'>> & {
  appendStep?: {
    detail?: string
    kind: AiAgentTaskStepKind
    status?: AiAgentTaskStepStatus
    title: string
  }
}) {
  const nextTask = {
    ...task,
    ...updates,
    updatedAt: Date.now(),
  }

  if (!updates.appendStep) {
    return nextTask
  }

  return appendAgentTaskStep(nextTask, updates.appendStep)
}

export function normalizeAgentTask(value: unknown): AiAgentTask | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.input !== 'string') {
    return null
  }

  const steps = Array.isArray(value.steps)
    ? value.steps
        .map(item => normalizeTaskStep(item))
        .filter((item): item is AiAgentTaskStep => !!item)
    : []

  if (!steps.length) {
    return null
  }

  return {
    confirmationMode: isConfirmationMode(value.confirmationMode) ? value.confirmationMode : 'none',
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    id: value.id,
    input: value.input,
    lastError: typeof value.lastError === 'string' ? value.lastError : '',
    lastRewriteSuggestion: typeof value.lastRewriteSuggestion === 'string' ? value.lastRewriteSuggestion : '',
    lastResponseText: typeof value.lastResponseText === 'string' ? value.lastResponseText : '',
    riskLevel: isRiskLevel(value.riskLevel) ? value.riskLevel : 'none',
    restoredFromReload: value.restoredFromReload === true,
    routeTargetSnapshot: normalizeRouteTargetSnapshot(value.routeTargetSnapshot),
    taskContextSnapshot: normalizeAiChatRequestContext(value.taskContextSnapshot),
    requiresRelocation: value.requiresRelocation === true,
    status: isTaskStatus(value.status) ? value.status : 'identifying',
    steps,
    terminationReason: isTerminationReason(value.terminationReason) ? value.terminationReason : 'running',
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
  }
}

export function restoreAgentTaskAfterReload(task: AiAgentTask): AiAgentTask {
  if (task.status === 'waiting_confirmation' || task.restoredFromReload) {
    return task
  }

  if (task.status === 'identifying' || task.status === 'executing') {
    return updateAgentTask(task, {
      appendStep: {
        kind: 'interrupted',
        title: '页面刷新后任务已中断',
        detail: '为避免重复执行，本次任务未自动继续。点击继续任务可重新发起。',
      },
      restoredFromReload: true,
      status: 'interrupted',
      terminationReason: 'restored',
    })
  }

  return task
}

export function getAgentTaskStatusLabel(status: AiAgentTaskStatus) {
  switch (status) {
    case 'identifying':
      return '理解中'
    case 'executing':
      return '执行中'
    case 'waiting_confirmation':
      return '待确认'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    case 'interrupted':
      return '已中断'
    case 'cancelled':
      return '已取消'
    default:
      return '处理中'
  }
}

export function getAgentTaskRiskLabel(riskLevel: AiAgentMutationRiskLevel) {
  switch (riskLevel) {
    case 'low':
      return '低风险'
    case 'medium':
      return '中风险'
    case 'high':
      return '高风险'
    case 'none':
    default:
      return ''
  }
}

export function getAgentTaskConfirmationModeLabel(mode: AiAgentConfirmationMode) {
  switch (mode) {
    case 'direct':
      return '可直接执行'
    case 'required':
      return '需确认'
    case 'none':
    default:
      return ''
  }
}
