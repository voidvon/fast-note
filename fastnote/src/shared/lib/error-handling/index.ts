export enum ErrorType {
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  FILE_OPERATION = 'FILE_OPERATION',
  SYNC = 'SYNC',
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  type: ErrorType
  message: string
  code?: string
  details?: unknown
  timestamp: number
}

class ErrorHandler {
  private errorLog: AppError[] = []

  logError(error: AppError): void {
    this.errorLog.push(error)
    console.error('[错误记录]', error)

    if (import.meta.env.DEV) {
      console.trace('错误堆栈:', error)
    }
  }

  createError(
    type: ErrorType,
    message: string,
    code?: string,
    details?: unknown,
  ): AppError {
    return {
      type,
      message,
      code,
      details,
      timestamp: Date.now(),
    }
  }

  handleDatabaseError(error: { code?: string } | unknown): AppError {
    const appError = this.createError(
      ErrorType.DATABASE,
      '数据库操作失败',
      getErrorCode(error),
      error,
    )
    this.logError(appError)
    return appError
  }

  handleNetworkError(error: { code?: string } | unknown): AppError {
    const appError = this.createError(
      ErrorType.NETWORK,
      '网络请求失败',
      getErrorCode(error),
      error,
    )
    this.logError(appError)
    return appError
  }

  handleFileError(error: { code?: string } | unknown): AppError {
    const appError = this.createError(
      ErrorType.FILE_OPERATION,
      '文件操作失败',
      getErrorCode(error),
      error,
    )
    this.logError(appError)
    return appError
  }

  handleValidationError(message: string, details?: unknown): AppError {
    const appError = this.createError(
      ErrorType.VALIDATION,
      message,
      'VALIDATION_ERROR',
      details,
    )
    this.logError(appError)
    return appError
  }

  getErrorLog(): AppError[] {
    return [...this.errorLog]
  }

  clearErrorLog(): void {
    this.errorLog = []
  }

  getUserFriendlyMessage(error: AppError): string {
    const messageMap: Record<ErrorType, string> = {
      [ErrorType.NETWORK]: '网络连接异常，请检查网络设置',
      [ErrorType.DATABASE]: '数据保存失败，请稍后重试',
      [ErrorType.VALIDATION]: '输入信息有误，请检查后重试',
      [ErrorType.PERMISSION]: '权限不足，无法执行此操作',
      [ErrorType.FILE_OPERATION]: '文件处理失败，请稍后重试',
      [ErrorType.SYNC]: '同步失败，请检查网络连接',
      [ErrorType.UNKNOWN]: '操作失败，请稍后重试',
    }

    return messageMap[error.type] || error.message
  }
}

function getErrorCode(error: { code?: string } | unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined
  }

  return typeof error.code === 'string' ? error.code : undefined
}

export const errorHandler = new ErrorHandler()

export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorType: ErrorType = ErrorType.UNKNOWN,
): Promise<{ data?: T, error?: AppError }> {
  try {
    const data = await operation()
    return { data }
  }
  catch (err) {
    const error = errorHandler.createError(
      errorType,
      err instanceof Error ? err.message : '操作失败',
      getErrorCode(err),
      err,
    )
    errorHandler.logError(error)
    return { error }
  }
}
