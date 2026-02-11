export function getTime(date?: string) {
  return new Date(date || Date.now()).toISOString().replace('T', ' ')
}
