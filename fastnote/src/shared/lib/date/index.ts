import dayjs from 'dayjs'
import calendar from 'dayjs/plugin/calendar'

dayjs.extend(calendar)

const NOTE_PREVIEW_CALENDAR_CONFIG = {
  sameDay: 'HH:mm',
  lastDay: '[昨天] HH:mm',
  lastWeek: 'YYYY/M/D',
  sameElse: 'YYYY/M/D',
}

export function getTime(date?: string) {
  return new Date(date || Date.now()).toISOString().replace('T', ' ')
}

export function formatNotePreviewDate(date?: string) {
  if (!date) {
    return ''
  }

  return dayjs(date).calendar(null, NOTE_PREVIEW_CALENDAR_CONFIG)
}

export function formatNotePreviewLine(date?: string, summary?: string) {
  return [formatNotePreviewDate(date), summary?.trim() || '']
    .filter(Boolean)
    .join('\u00A0\u00A0')
}
