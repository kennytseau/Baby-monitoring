import { parseISODate, toISODate } from './age'

/** A moment formatted for a datetime-local input (YYYY-MM-DDTHH:mm), in local time */
export function toDatetimeInput(at: string | Date = new Date()): string {
  const d = typeof at === 'string' ? new Date(at) : at
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Current local time for a datetime-local input */
export function nowLocalDatetime(): string {
  return toDatetimeInput()
}

/**
 * A number typed into a form, or nothing. Blank, nonsense and zero-or-less all
 * come back undefined, which is what every amount field in the app wants:
 * a feed of 0 ml is not a feed, it is an empty box.
 */
export function positiveNumber(value: string): number | undefined {
  const n = Number(value)
  return value.trim() && Number.isFinite(n) && n > 0 ? n : undefined
}

export function todayISO(): string {
  return toISODate(new Date())
}

/** "13:05" from an ISO datetime or a Date */
export function formatTime(at: string | Date): string {
  const date = typeof at === 'string' ? new Date(at) : at
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
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
  // Round once, up front: 119.9 minutes is "2 h", not "1 h 60 m".
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} m`
}

/** Live stopwatch reading from minutes: "7:12" under an hour, else "1:03:20" */
export function formatStopwatch(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes * 60))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** "just now" / "25 min ago" / "3 h 10 m ago" */
export function formatAgo(iso: string, now: Date = new Date()): string {
  const minutes = (now.getTime() - new Date(iso).getTime()) / 60000
  if (minutes < 1) return 'just now'
  return `${formatDuration(minutes)} ago`
}

/** Minutes past local midnight, used to place entries on a 24-hour strip */
export function minutesIntoDay(at: string | Date): number {
  const d = typeof at === 'string' ? new Date(at) : at
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

/**
 * Turn "HH:mm" from a time input into a real datetime: the occurrence of that
 * clock time nearest to now, which may be either side of it.
 *
 * Both directions come up. A 23:50 bedtime typed at 00:10 means last night —
 * twenty minutes ago, not twenty-three hours away. A 00:10 feed typed at 23:50
 * means twenty minutes from now. Taking the nearest occurrence gets both right
 * without a rule about which way time is allowed to run, and it lets a time be
 * set a little ahead on purpose: the app simply treats that entry as not yet
 * having happened until it does.
 */
export function dateFromTimeInput(value: string, now: Date = new Date()): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null

  const today = new Date(now)
  today.setHours(hours, minutes, 0, 0)
  const shifted = new Date(today)
  shifted.setDate(shifted.getDate() + (today.getTime() > now.getTime() ? -1 : 1))
  return Math.abs(today.getTime() - now.getTime()) <= Math.abs(shifted.getTime() - now.getTime())
    ? today
    : shifted
}

/** "HH:mm" for a time input, defaulting its value to now */
export function toTimeInput(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** How far back a quick-log entry is being recorded */
export interface LogTimeChoice {
  /** Minutes before now, for the one-tap offsets */
  offsetMinutes: number
  /** "HH:mm" typed in, which wins over the offset when set */
  exactTime?: string
}

/**
 * The moment a quick-log entry should be stamped with. Offsets are measured
 * from the tap that saves it, not from when the offset was chosen, so taking a
 * while to type an amount does not drag the time backwards with you.
 */
export function resolveLogTime(choice: LogTimeChoice, now: Date = new Date()): Date {
  if (choice.exactTime) {
    const exact = dateFromTimeInput(choice.exactTime, now)
    if (exact) return exact
  }
  const offset = Number.isFinite(choice.offsetMinutes) ? Math.max(0, choice.offsetMinutes) : 0
  return offset === 0 ? now : new Date(now.getTime() - offset * 60_000)
}
