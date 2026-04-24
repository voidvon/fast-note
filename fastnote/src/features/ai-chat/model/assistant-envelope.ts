import type { AiToolResult } from '@/shared/types'

export function extractVisibleAiAssistantText(rawText: string) {
  return rawText.trim()
}

export function summarizePreviewResults(results: AiToolResult[]) {
  const lines = results.map((result) => {
    const title = result.preview?.title || '待执行操作'
    const summary = result.preview?.summary || '已生成执行预览'
    return `- ${title}：${summary}`
  })

  return [
    '我已根据你的请求生成执行预览：',
    ...lines,
    '',
    '请确认是否继续执行。',
  ].join('\n')
}

export function summarizeExecutionResults(results: AiToolResult[]) {
  const lines = results.map((result) => {
    const status = result.ok ? '已完成' : '失败'
    const summary = result.preview?.summary || result.message || result.code
    const suffix = result.humanActionRequired ? '（需要人工完成后续步骤）' : ''
    return `- ${status}：${summary}${suffix}`
  })

  return [
    '本次操作执行结果如下：',
    ...lines,
  ].join('\n')
}

export function mergeAssistantAnswer(answer: string | undefined, summary: string) {
  const trimmedAnswer = answer?.trim()
  if (!trimmedAnswer) {
    return summary
  }

  return `${trimmedAnswer}\n\n${summary}`
}
