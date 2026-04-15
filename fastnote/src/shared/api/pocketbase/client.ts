import PocketBase from 'pocketbase'

export function resolvePocketBaseUrl() {
  const configuredUrl = import.meta.env.VITE_POCKETBASE_URL?.trim()
  if (configuredUrl) {
    return configuredUrl
  }

  return '/'
}

const pocketbaseUrl = resolvePocketBaseUrl()

export const pb = new PocketBase(pocketbaseUrl)

if (import.meta.env.DEV) {
  ;(window as any).pb = pb
}

export function mapErrorMessage(error: any): string {
  const errorMessage = error?.message || error?.toString() || '未知错误'

  const errorMap: Record<string, string> = {
    'Failed to authenticate.': '邮箱或密码错误',
    'The request requires valid authentication.': '需要有效的身份认证',
    'Record not found.': '用户不存在',
    'Network Error': '网络连接错误',
    'Failed to fetch': '网络连接失败',
    'Something went wrong while processing your request.': '请求处理失败',
    'You are not allowed to perform this request.': '没有权限执行此操作',
  }

  return errorMap[errorMessage] || errorMessage
}
