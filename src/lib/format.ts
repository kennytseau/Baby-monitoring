import { parseISODate, toISODate } from './age'

/** Current local time formatted for a datetime-local input (YYYY-MM-DDTHH:mm) */
export function nowLocalDatetime(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

/** "13:05" from an ISO datetime */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** Day portion (YYYY-MM-DD) of an ISO datetime or date */
export function dayOf(iso: string): string {
  if (iso.includes('T')) {
    const d = new Date(iso)
    return toISODate(d)
  }
  return iso
}

/** "Today", "Yesterday", or a readable date */
export function formatDayLabel(isoDay: string): string {
  const today = todayISO()
  if (isoDay === today) return 'Today'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (isoDay === toISODate(yesterday)) return 'Yesterday'
  return parseISODate(isoDay).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function formatDate(isoDay: string): string {
  return parseISODate(isoDay).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "1 h 25 m" from minutes */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} m`
}
