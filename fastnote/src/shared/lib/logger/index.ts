const isDev = import.meta.env.DEV

export const logger = {
  debug: (..._args: any[]) => {},
  info: (..._args: any[]) => {},
  warn: (...args: any[]) => {
    if (isDev)
      console.warn(...args)
  },
  error: (...args: any[]) => {
    console.error(...args)
  },
}
