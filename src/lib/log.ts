import type {
  BottleContent,
  BreastSide,
  FeedEntry,
  LogEntry,
  NappyKind,
  PumpEntry,
  SleepEntry,
} from './types'
import { formatDuration, formatTime } from './format'

const MS_PER_MINUTE = 60_000

export const NAPPY_LABELS: Record<NappyKind, string> = {
  wet: 'Wet',
  poo: 'Poo',
  mixed: 'Wet + poo',
}

/** Labels for every value that can appear in saved data, including older entries */
export const BOTTLE_LABELS: Record<BottleContent, string> = {
  formula: 'Formula',
  expressed: 'Breast milk',
  mixed: 'Formula + breast milk',
}

/** What a bottle can be logged as now — 'mixed' is kept above so old entries still read correctly */
export const BOTTLE_OPTIONS: BottleContent[] = ['formula', 'expressed']

export const SIDE_LABELS: Record<BreastSide, string> = { left: 'Left', right: 'Right' }

/** Minutes elapsed between two ISO datetimes, never negative */
export function minutesBetween(fromIso: string, toIso: string): number {
  const mins = (new Date(toIso).getTime() - new Date(fromIso).getTime()) / MS_PER_MINUTE
  return mins > 0 ? mins : 0
}

export function isNursing(entry: LogEntry): entry is FeedEntry {
  return entry.type === 'feed' && entry.kind === 'nursing'
}

/** A nursing session with a side still being timed */
export function isNursingRunning(entry: LogEntry): entry is FeedEntry {
  return isNursing(entry) && !!entry.activeSide && !!entry.sideStartedAt
}

/** Minutes on one side, including the live side while the timer runs */
export function sideMinutes(entry: FeedEntry, side: BreastSide, now = new Date()): number {
  const banked = (side === 'left' ? entry.leftMinutes : entry.rightMinutes) ?? 0
  if (entry.activeSide !== side || !entry.sideStartedAt) return banked
  return banked + minutesBetween(entry.sideStartedAt, now.toISOString())
}

/** Total minutes spent nursing in a session, live side included */
export function nursingMinutes(entry: FeedEntry, now = new Date()): number {
  return sideMinutes(entry, 'left', now) + sideMinutes(entry, 'right', now)
}

/** Minutes asleep; an open sleep counts up to `now` */
export function sleepMinutes(entry: SleepEntry, now = new Date()): number {
  return minutesBetween(entry.time, entry.endTime ?? now.toISOString())
}

/** What the session yielded — the sides when they were measured, else the combined amount */
export function pumpTotalMl(entry: PumpEntry): number {
  const sides = (entry.leftMl ?? 0) + (entry.rightMl ?? 0)
  return sides > 0 ? sides : (entry.totalMl ?? 0)
}

/** The sleep that has started but not ended, if the baby is asleep right now */
export function findOpenSleep(log: LogEntry[]): SleepEntry | undefined {
  return log.find((e): e is SleepEntry => e.type === 'sleep' && !e.endTime)
}

/** The nursing session with a running timer, if any */
export function findRunningNursing(log: LogEntry[]): FeedEntry | undefined {
  return log.find(isNursingRunning)
}

export function sortedByTime<T extends { time: string }>(
  entries: T[],
  direction: 'asc' | 'desc' = 'desc',
): T[] {
  const sign = direction === 'desc' ? -1 : 1
  return [...entries].sort((a, b) => sign * a.time.localeCompare(b.time))
}

export interface WakeWindow {
  /** ISO datetime the baby woke */
  start: string
  /** ISO datetime the next sleep began, or `now` if still awake */
  end: string
  minutes: number
  /** True when this window is still running */
  open: boolean
}

/**
 * The gaps between sleeps — how long the baby was awake each time.
 * Sleeps are read in start order; an unfinished sleep closes the list.
 */
export function wakeWindows(log: LogEntry[], now = new Date()): WakeWindow[] {
  const sleeps = sortedByTime(
    log.filter((e): e is SleepEntry => e.type === 'sleep'),
    'asc',
  )
  const windows: WakeWindow[] = []
  for (let i = 0; i < sleeps.length; i += 1) {
    const woke = sleeps[i].endTime
    if (!woke) continue
    const nextSleep = sleeps.slice(i + 1).find((s) => s.time > woke)
    const end = nextSleep?.time ?? now.toISOString()
    if (end <= woke) continue
    windows.push({ start: woke, end, minutes: minutesBetween(woke, end), open: !nextSleep })
  }
  return windows
}

/** How long the baby has been awake right now, or null if she's asleep */
export function currentWakeMinutes(log: LogEntry[], now = new Date()): number | null {
  if (findOpenSleep(log)) return null
  const lastWoke = sortedByTime(log.filter((e): e is SleepEntry => e.type === 'sleep'))
    .map((e) => e.endTime)
    .find((t): t is string => !!t)
  if (!lastWoke) return null
  return minutesBetween(lastWoke, now.toISOString())
}

export interface DayTotals {
  feeds: number
  nursingSessions: number
  nursingMinutes: number
  leftMinutes: number
  rightMinutes: number
  bottles: number
  bottleMl: number
  formulaMl: number
  expressedMl: number
  solids: number
  nappies: Record<NappyKind, number>
  nappyTotal: number
  sleepMinutes: number
  longestSleepMinutes: number
  sleeps: number
  pumpSessions: number
  pumpedLeftMl: number
  pumpedRightMl: number
  pumpedMl: number
}

/** Roll a day's (or any slice's) entries up into the numbers parents actually compare */
export function dayTotals(entries: LogEntry[], now = new Date()): DayTotals {
  const totals: DayTotals = {
    feeds: 0,
    nursingSessions: 0,
    nursingMinutes: 0,
    leftMinutes: 0,
    rightMinutes: 0,
    bottles: 0,
    bottleMl: 0,
    formulaMl: 0,
    expressedMl: 0,
    solids: 0,
    nappies: { wet: 0, poo: 0, mixed: 0 },
    nappyTotal: 0,
    sleepMinutes: 0,
    longestSleepMinutes: 0,
    sleeps: 0,
    pumpSessions: 0,
    pumpedLeftMl: 0,
    pumpedRightMl: 0,
    pumpedMl: 0,
  }

  for (const entry of entries) {
    if (entry.type === 'feed') {
      totals.feeds += 1
      if (entry.kind === 'nursing') {
        totals.nursingSessions += 1
        totals.leftMinutes += sideMinutes(entry, 'left', now)
        totals.rightMinutes += sideMinutes(entry, 'right', now)
        totals.nursingMinutes += nursingMinutes(entry, now)
      } else if (entry.kind === 'bottle') {
        totals.bottles += 1
        const ml = entry.amountMl ?? 0
        totals.bottleMl += ml
        if (entry.contents === 'expressed') totals.expressedMl += ml
        else if (entry.contents === 'formula') totals.formulaMl += ml
      } else {
        totals.solids += 1
      }
    } else if (entry.type === 'sleep') {
      const mins = sleepMinutes(entry, now)
      totals.sleeps += 1
      totals.sleepMinutes += mins
      totals.longestSleepMinutes = Math.max(totals.longestSleepMinutes, mins)
    } else if (entry.type === 'nappy') {
      totals.nappies[entry.kind] += 1
      totals.nappyTotal += 1
    } else {
      totals.pumpSessions += 1
      totals.pumpedLeftMl += entry.leftMl ?? 0
      totals.pumpedRightMl += entry.rightMl ?? 0
      totals.pumpedMl += pumpTotalMl(entry)
    }
  }
  return totals
}

export interface EntrySummary {
  /** Headline for the timeline row */
  title: string
  /** The supporting numbers: sides, amounts, start/end times */
  detail: string
}

/** How a log entry reads in a timeline row */
export function summarizeEntry(entry: LogEntry, now = new Date()): EntrySummary {
  switch (entry.type) {
    case 'feed':
      return summarizeFeed(entry, now)
    case 'sleep': {
      const mins = sleepMinutes(entry, now)
      if (!entry.endTime) return { title: `Asleep · ${formatDuration(mins)} so far`, detail: '' }
      return { title: `Slept ${formatDuration(mins)}`, detail: `until ${formatTime(entry.endTime)}` }
    }
    case 'nappy':
      return { title: `Nappy · ${NAPPY_LABELS[entry.kind]}`, detail: '' }
    case 'pump': {
      const parts = [
        entry.leftMl != null ? `L ${entry.leftMl} ml` : null,
        entry.rightMl != null ? `R ${entry.rightMl} ml` : null,
        entry.leftMl == null && entry.rightMl == null && entry.totalMl != null ? 'both sides' : null,
        entry.durationMinutes ? formatDuration(entry.durationMinutes) : null,
      ].filter(Boolean)
      return { title: `Pumped ${pumpTotalMl(entry)} ml`, detail: parts.join(' · ') }
    }
  }
}

function summarizeFeed(entry: FeedEntry, now: Date): EntrySummary {
  if (entry.kind === 'nursing') {
    const left = sideMinutes(entry, 'left', now)
    const right = sideMinutes(entry, 'right', now)
    const sides = [
      left > 0 ? `L ${formatDuration(left)}` : null,
      right > 0 ? `R ${formatDuration(right)}` : null,
    ].filter(Boolean)
    const running = isNursingRunning(entry) ? ' (running)' : ''
    return {
      title: `Nursed ${formatDuration(left + right)}${running}`,
      detail: sides.length ? sides.join(' · ') : 'no duration recorded',
    }
  }
  if (entry.kind === 'solids') return { title: 'Solids', detail: '' }
  const label = entry.contents ? BOTTLE_LABELS[entry.contents] : 'Bottle'
  return {
    title: entry.amountMl ? `${label} · ${entry.amountMl} ml` : label,
    detail: entry.contents === 'expressed' ? 'expressed breast milk' : '',
  }
}

/** Bank the minutes on the side being timed and stop the timer */
export function commitNursingSide(entry: FeedEntry, now = new Date()): FeedEntry {
  if (!entry.activeSide || !entry.sideStartedAt) return entry
  const minutes = minutesBetween(entry.sideStartedAt, now.toISOString())
  const banked = (entry.activeSide === 'left' ? entry.leftMinutes : entry.rightMinutes) ?? 0
  const total = Math.round((banked + minutes) * 10) / 10
  return {
    ...entry,
    leftMinutes: entry.activeSide === 'left' ? total : entry.leftMinutes,
    rightMinutes: entry.activeSide === 'right' ? total : entry.rightMinutes,
    activeSide: undefined,
    sideStartedAt: undefined,
  }
}

/** Bank the current side and start timing the other one */
export function switchNursingSide(entry: FeedEntry, side: BreastSide, now = new Date()): FeedEntry {
  return { ...commitNursingSide(entry, now), activeSide: side, sideStartedAt: now.toISOString() }
}

/** A fresh nursing session with the timer already running on `side` */
export function startNursingSession(id: string, side: BreastSide, now = new Date()): FeedEntry {
  const iso = now.toISOString()
  return { id, type: 'feed', kind: 'nursing', time: iso, activeSide: side, sideStartedAt: iso }
}
