import type { LogEntry, SleepEntry } from './types'
import { dayTotals, dayWindow, entriesWithin, sleepMinutesWithin } from './log'
import type { DayTotals } from './log'
import { toISODate } from './age'

/** A daytime sleep counts as a nap; the rest is night sleep */
const NAP_START_HOUR = 6
const NAP_END_HOUR = 19

export interface DaySummary {
  /** ISO day, YYYY-MM-DD */
  day: string
  isToday: boolean
  totals: DayTotals
  /** Daytime sleep only, split out from the total */
  napMinutes: number
  naps: number
}

/** Which measures a day can be compared on */
export type TrendMetric = 'milk' | 'nursing' | 'sleep' | 'naps' | 'nappies' | 'pumped'

export interface TrendPoint {
  day: string
  isToday: boolean
  value: number
}

export interface TrendSeries {
  metric: TrendMetric
  points: TrendPoint[]
  average: number
  min: number
  max: number
  /** Today's value, when today is in range */
  today?: number
  /** Average of the whole days before today — the level the dashed rule sits at */
  usual: number
  /** What she would usually have had by this time of day, for the comparison */
  usualByNow?: number
}

function isNap(entry: SleepEntry): boolean {
  const hour = new Date(entry.time).getHours()
  return hour >= NAP_START_HOUR && hour < NAP_END_HOUR
}

/**
 * The last `days` days, newest first, each rolled up the same way the daily log
 * rolls up a day. Days with nothing logged are included as empty, so a gap in
 * the record reads as a gap rather than closing up.
 *
 * `cutoffToNow` trims the finished days to the time of day it is now, which is
 * how "is she under her usual?" gets an answer worth having before bedtime.
 */
export function dailySummaries(
  log: LogEntry[],
  days = 8,
  now = new Date(),
  cutoffToNow = false,
): DaySummary[] {
  const today = toISODate(now)
  const summaries: DaySummary[] = []
  for (let back = 0; back < days; back += 1) {
    const date = new Date(now)
    date.setDate(date.getDate() - back)
    const day = toISODate(date)
    // Midnight to midnight — or, to compare fairly, a past day only up to the
    // time of day it is now. A sleep that crosses a boundary counts on each
    // side for the part that falls there.
    const window = dayWindow(day)
    if (cutoffToNow && day !== today) {
      window.to = new Date(window.from)
      window.to.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())
    }
    const entries = entriesWithin(log, window, now)
    const naps = entries.filter((e): e is SleepEntry => e.type === 'sleep' && isNap(e))
    summaries.push({
      day,
      isToday: day === today,
      totals: dayTotals(entries, now, window),
      napMinutes: naps.reduce((total, nap) => total + sleepMinutesWithin(nap, window, now), 0),
      naps: naps.length,
    })
  }
  return summaries
}

function valueFor(summary: DaySummary, metric: TrendMetric): number {
  switch (metric) {
    case 'milk':
      return summary.totals.bottleMl
    case 'nursing':
      return summary.totals.nursingMinutes
    case 'sleep':
      return summary.totals.sleepMinutes
    case 'naps':
      return summary.napMinutes
    case 'nappies':
      return summary.totals.nappyTotal
    case 'pumped':
      return summary.totals.pumpedMl
  }
}

/**
 * One measure across the days, oldest first so it reads left to right.
 * "Usual" deliberately excludes today: a day that is only half over would drag
 * its own comparison down.
 */
export function trendSeries(
  summaries: DaySummary[],
  metric: TrendMetric,
  /** The same days trimmed to the current time of day, when a fair comparison is wanted */
  summariesByNow?: DaySummary[],
): TrendSeries {
  const ordered = [...summaries].reverse()
  const points = ordered.map((s) => ({ day: s.day, isToday: s.isToday, value: valueFor(s, metric) }))
  const values = points.map((p) => p.value)
  const past = points.filter((p) => !p.isToday).map((p) => p.value)
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const byNow = summariesByNow
    ? mean(summariesByNow.filter((s) => !s.isToday).map((s) => valueFor(s, metric)))
    : undefined
  return {
    metric,
    points,
    average: mean(values),
    min: values.length ? Math.min(...values) : 0,
    max: values.length ? Math.max(...values) : 0,
    today: points.find((p) => p.isToday)?.value,
    usual: mean(past),
    usualByNow: byNow,
  }
}

/**
 * Today against what she would usually have had by this time of day, as a
 * percentage. Comparing a half-finished day against whole days would report
 * every morning as a shortfall, which is noise rather than news.
 */
export function comparedToUsual(series: TrendSeries): number | null {
  const baseline = series.usualByNow ?? series.usual
  if (series.today == null || baseline <= 0) return null
  return Math.round(((series.today - baseline) / baseline) * 100)
}
