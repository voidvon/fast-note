const isDev = import.meta.env.DEV

export const logger = {
  debug: (...args: any[]) => {
    if (isDev)
      console.warn(...args)
  },
  info: (...args: any[]) => {
    if (isDev)
      console.warn(...args)
  },
  warn: (...args: any[]) => {
    if (isDev)
      console.warn(...args)
  },
  error: (...args: any[]) => {
    console.error(...args)
  },
}
