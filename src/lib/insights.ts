import type { GrowthEntry, LogEntry } from './types'
import { happenedBy } from './log'
import { dailySummaries } from './trends'
import { sleepPattern } from './pattern'
import { sleepBlocks } from './rhythm'
import { MS_PER_MINUTE, quantile } from './patterns'
import type { GuideId } from '../data/age-guides'
import { parseISODate } from './age'

/**
 * Her own last week, in the same units as the age guides, so the two can sit
 * side by side. For reading only: none of this goes near a prediction.
 */

/** Whole days looked back over; today is left out because it is not over */
const DAYS = 7
/** Fewer logged days than this and an average says more about the gaps than about her */
const MIN_DAYS = 3
/** A gap longer than this between sleeps is missing data, not a wake window */
const MAX_WAKE_MINUTES = 8 * 60
/** Weight gain needs readings at least this far apart to mean anything */
const MIN_WEIGHT_SPAN_DAYS = 10
/** ...and no further back than this, so it describes lately */
const MAX_WEIGHT_SPAN_DAYS = 42

export interface HerWeek {
  /** Days with something logged, out of the last seven */
  days: number
  /** Per-day averages and her typical wake window, keyed like the guides */
  values: Partial<Record<GuideId, number>>
  /** True when she has nursing logged too, so bottles are not all her milk */
  alsoNursed: boolean
  latestWeightKg?: number
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function herWeek(log: LogEntry[], growth: GrowthEntry[], now = new Date()): HerWeek {
  const values: HerWeek['values'] = {}
  const weights = growth
    .filter((g) => g.weightKg != null && !g.deletedAt)
    .sort((a, b) => a.date.localeCompare(b.date))
  const latest = weights[weights.length - 1]
  if (latest) {
    const latestDay = parseISODate(latest.date).getTime()
    const earlier = weights.find((g) => {
      const span = (latestDay - parseISODate(g.date).getTime()) / (24 * 60 * MS_PER_MINUTE)
      return span >= MIN_WEIGHT_SPAN_DAYS && span <= MAX_WEIGHT_SPAN_DAYS
    })
    if (earlier) {
      const weeks = (latestDay - parseISODate(earlier.date).getTime()) / (7 * 24 * 60 * MS_PER_MINUTE)
      values.weight = Math.round(((latest.weightKg! - earlier.weightKg!) * 1000) / weeks)
    }
  }

  const pattern = sleepPattern(log, DAYS + 1, now).filter(
    (d) => !d.isToday && (d.sleeps.length > 0 || d.feeds.length > 0),
  )
  const summaries = dailySummaries(log, DAYS + 1, now).filter(
    (s) => !s.isToday && (s.totals.feeds > 0 || s.totals.sleeps > 0 || s.totals.nappyTotal > 0),
  )
  const days = Math.max(pattern.length, summaries.length)
  const result: HerWeek = {
    days,
    values,
    alsoNursed: summaries.some((s) => s.totals.nursingSessions > 0),
    latestWeightKg: latest?.weightKg,
  }
  if (days < MIN_DAYS) return result

  // Each averaged over the days it was logged on: a day with feeds but no
  // sleep logged is a gap in the sleep record, not a day without sleep
  const slept = pattern.filter((d) => d.sleeps.length > 0)
  const fed = pattern.filter((d) => d.feeds.length > 0)
  if (slept.length >= MIN_DAYS) values.sleep = mean(slept.map((d) => d.asleepMinutes))
  if (fed.length >= MIN_DAYS) values.feeds = mean(fed.map((d) => d.feeds.length))
  if (summaries.length >= MIN_DAYS) {
    values.naps = mean(summaries.map((s) => s.naps))
    values.wet = mean(summaries.map((s) => s.totals.nappies.wet + s.totals.nappies.mixed))
    const bottles = mean(summaries.map((s) => s.totals.bottleMl))
    if (bottles > 0) values.bottle = bottles
  }

  // Her typical wake window over the same week, from sleeps joined up the way
  // the rhythm card joins them, so a stir and resettle is not a wake window
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const from = midnight.getTime() - DAYS * 24 * 60 * MS_PER_MINUTE
  const blocks = sleepBlocks(happenedBy(log, now), now)
  const gaps: number[] = []
  for (let i = 0; i < blocks.length - 1; i += 1) {
    const woke = blocks[i].end.getTime()
    if (woke < from || woke >= midnight.getTime()) continue
    const minutes = (blocks[i + 1].start.getTime() - woke) / MS_PER_MINUTE
    if (minutes > 0 && minutes <= MAX_WAKE_MINUTES) gaps.push(minutes)
  }
  if (gaps.length >= MIN_DAYS) values.wake = quantile([...gaps].sort((a, b) => a - b), 0.5)

  return result
}
