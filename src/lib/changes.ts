import type { FeedEntry, LogEntry } from './types'
import { happenedBy, sortedByTime } from './log'
import { sleepBlocks, type SleepBlock } from './rhythm'
import { SAME_EVENT_MINUTES } from './needs'
import { MS_PER_MINUTE, quantile } from './patterns'
import { toISODate } from './age'

/**
 * Noticing when her pattern shifts — nights breaking up, naps shortening,
 * feeds bunching — against her own recent normal rather than any chart.
 *
 * A change has to hold for several days in a row, all of them past the edge of
 * her usual spread, before it is mentioned. One bad night is a bad night.
 */

/** The night that ends on a morning runs from this hour the evening before... */
const NIGHT_FROM_HOUR = 19
/** ...to this hour that morning; the day runs between the two */
const NIGHT_UNTIL_HOUR = 7
/** How many of the latest days make up "lately" */
export const RECENT_DAYS = 3
/** Her usual is drawn from this many days before those */
const BASELINE_DAYS = 14
/** Fewer days than this and her "usual" is not worth comparing against */
const MIN_BASELINE_DAYS = 7
/** A bit of sleep shorter than this is a stir, not a nap, and is not counted as one */
const MIN_NAP_MINUTES = 5

export type MeasureId =
  | 'longestNight'
  | 'nightWakings'
  | 'nightSleep'
  | 'napLength'
  | 'daySleep'
  | 'feeds'

/** One night (keyed by the morning it ends on) and the day that follows it */
export interface DayMeasures {
  /** ISO day of the morning */
  day: string
  values: Partial<Record<MeasureId, number>>
}

function at(day: Date, hour: number): Date {
  const d = new Date(day)
  d.setHours(hour, 0, 0, 0)
  return d
}

function overlapMinutes(block: SleepBlock, from: Date, to: Date): number {
  const start = Math.max(block.start.getTime(), from.getTime())
  const end = Math.min(block.end.getTime(), to.getTime())
  return Math.max(0, (end - start) / MS_PER_MINUTE)
}

/** More than half of this sleep falls between `from` and `to` */
function mostlyWithin(block: SleepBlock, from: Date, to: Date): boolean {
  return overlapMinutes(block, from, to) * 2 > block.minutes
}

/** A sleep that touches this stretch has not ended yet, so it cannot be measured */
function stillGoing(blocks: SleepBlock[], from: Date, to: Date): boolean {
  return blocks.some((b) => b.open && b.end > from && b.start < to)
}

function median(xs: number[]): number {
  return quantile([...xs].sort((a, b) => a - b), 0.5)
}

/**
 * Her nights and days, oldest first, as far back as the log goes.
 *
 * Each sleep belongs to whichever of the night or the day holds most of it, so
 * a 6:20pm bedtime that runs to 10:30 is the start of her night, not a nap.
 * A night is measured once it is over (7am) and no sleep in it is still going;
 * the same for a day (7pm for naps, midnight for feeds). A night or day with
 * no sleep logged in it at all is treated as not logged rather than as none.
 */
export function dailyMeasures(log: LogEntry[], now = new Date()): DayMeasures[] {
  const happened = happenedBy(log, now)
  if (happened.length === 0) return []
  const blocks = sleepBlocks(happened, now)
  const feeds = sortedByTime(
    happened.filter((e): e is FeedEntry => e.type === 'feed'),
    'asc',
  )

  // Feeds merged into events, the way the feed predictions count them
  const feedDays = new Map<string, number>()
  let lastFeed = -Infinity
  for (const feed of feeds) {
    const time = Date.parse(feed.time)
    if ((time - lastFeed) / MS_PER_MINUTE >= SAME_EVENT_MINUTES) {
      const day = toISODate(new Date(time))
      feedDays.set(day, (feedDays.get(day) ?? 0) + 1)
    }
    lastFeed = time
  }

  const first = new Date(sortedByTime(happened, 'asc')[0].time)
  const days: DayMeasures[] = []
  for (let morning = at(first, 0); morning <= now; morning.setDate(morning.getDate() + 1)) {
    const day = toISODate(morning)
    const values: DayMeasures['values'] = {}

    const nightFrom = at(morning, NIGHT_FROM_HOUR)
    nightFrom.setDate(nightFrom.getDate() - 1)
    const nightTo = at(morning, NIGHT_UNTIL_HOUR)
    if (nightTo <= now && nightFrom >= at(first, 0) && !stillGoing(blocks, nightFrom, nightTo)) {
      const night = blocks.filter((b) => mostlyWithin(b, nightFrom, nightTo))
      if (night.length > 0) {
        values.longestNight = Math.max(...night.map((b) => b.minutes))
        values.nightWakings = night.length - 1
        values.nightSleep = blocks.reduce((total, b) => total + overlapMinutes(b, nightFrom, nightTo), 0)
      }
    }

    const dayTo = at(morning, NIGHT_FROM_HOUR)
    if (dayTo <= now && !stillGoing(blocks, nightTo, dayTo)) {
      const naps = blocks.filter((b) => mostlyWithin(b, nightTo, dayTo) && b.minutes >= MIN_NAP_MINUTES)
      if (naps.length > 0) {
        values.napLength = median(naps.map((b) => b.minutes))
        values.daySleep = blocks.reduce((total, b) => total + overlapMinutes(b, nightTo, dayTo), 0)
      }
    }

    const midnight = at(morning, 0)
    midnight.setDate(midnight.getDate() + 1)
    if (midnight <= now && feedDays.has(day)) values.feeds = feedDays.get(day)

    days.push({ day, values })
  }
  return days
}

/**
 * Lately has to be this far from her usual before it counts as a change: a
 * quarter for times, one waking, two feeds. Settled by running the rule back
 * over her whole log — a change every three or four days at this fast-changing
 * age, each one a parent would recognise (the 6-week feeding spurt, naps
 * halving in August).
 */
const MIN_RELATIVE_CHANGE = 0.25
const MIN_ABSOLUTE_CHANGE: Partial<Record<MeasureId, number>> = { nightWakings: 1, feeds: 2 }
/** Her "usual spread" is the middle half of the baseline days */
const SPREAD = 0.25
/** A change is about now: the newest day it rests on can be no older than this */
const STALE_DAYS = 2
/**
 * How long a change is news. After a fortnight it is her new normal — and the
 * predictions, which learn from her last fortnight, have caught up with it.
 */
export const NEWS_DAYS = 14
/**
 * A sleep regression is followed for longer, since it commonly runs two to six
 * weeks and the point is to know it is still going on.
 */
export const REGRESSION_DAYS = 42
/** Once going, most of its days have to stay outside her old spread */
const MIN_SHARE_BEYOND = 0.75

export interface PatternChange {
  measure: MeasureId
  direction: 'up' | 'down'
  /** Median of the baseline days */
  usual: number
  /** Median of the last three days */
  lately: number
  /** Every day since it began, oldest first */
  days: string[]
}

/**
 * What has shifted lately: each measure whose days since some point all sit
 * outside the middle half of the fortnight before that point, the same way,
 * and by enough to matter.
 *
 * A change is measured against the fortnight before it began, not the
 * fortnight before today — otherwise, a week into a regression, the bad nights
 * would have become her "usual" and the change would quietly vanish while it
 * was still going on. It ends when her last days are back inside that spread.
 *
 * Read-only: the predictions do not use it.
 */
export function patternChanges(
  measures: DayMeasures[],
  now = new Date(),
  maxDays = NEWS_DAYS,
): PatternChange[] {
  const freshFrom = new Date(now)
  freshFrom.setDate(freshFrom.getDate() - STALE_DAYS)
  const fresh = toISODate(freshFrom)
  const changes: PatternChange[] = []

  for (const measure of MEASURES) {
    const series = measures.filter((m) => m.values[measure] != null)
    if (series.length < RECENT_DAYS + MIN_BASELINE_DAYS) continue
    if (series[series.length - 1].day < fresh) continue

    // The earliest start that still holds, so a long change keeps its first baseline
    let found: PatternChange | null = null
    const latestStart = series.length - RECENT_DAYS
    const earliestStart = Math.max(MIN_BASELINE_DAYS, series.length - maxDays)
    for (let start = latestStart; start >= earliestStart; start -= 1) {
      const change = changeFrom(series, start, measure)
      if (change) found = change
      else if (found) break
    }
    if (found) changes.push(found)
  }
  return changes
}

/** Whether the days from `start` on are a change against the fortnight before them */
function changeFrom(series: DayMeasures[], start: number, measure: MeasureId): PatternChange | null {
  const since = series.slice(start)
  const values = since.map((m) => m.values[measure]!)
  const baseline = series
    .slice(Math.max(0, start - BASELINE_DAYS), start)
    .map((m) => m.values[measure]!)
    .sort((a, b) => a - b)
  const low = quantile(baseline, SPREAD)
  const high = quantile(baseline, 1 - SPREAD)
  const usual = quantile(baseline, 0.5)
  const lately = median(values.slice(-RECENT_DAYS))
  const absolute = MIN_ABSOLUTE_CHANGE[measure]
  const enough = (delta: number) =>
    absolute != null ? delta >= absolute : delta >= usual * MIN_RELATIVE_CHANGE

  for (const direction of ['down', 'up'] as const) {
    const beyond = (v: number) => (direction === 'down' ? v < low : v > high)
    const opening = values.slice(0, RECENT_DAYS).every(beyond)
    const holding = values.filter(beyond).length >= values.length * MIN_SHARE_BEYOND
    const still = values.slice(-RECENT_DAYS).filter(beyond).length >= RECENT_DAYS - 1
    const delta = direction === 'down' ? usual - median(values) : median(values) - usual
    if (opening && holding && still && enough(delta)) {
      return { measure, direction, usual, lately, days: since.map((m) => m.day) }
    }
  }
  return null
}

const MEASURES: MeasureId[] = [
  'longestNight',
  'nightWakings',
  'nightSleep',
  'napLength',
  'daySleep',
  'feeds',
]

/**
 * The "4-month" sleep regression: a lasting change in how sleep is built, as
 * her sleep cycles mature, that shows as more night wakings, a shorter longest
 * stretch and naps cut to one cycle. It is commonly seen somewhere between
 * about 12 and 20 weeks, but when it starts is not something any log can tell
 * in advance — what it can do is spot the signs within a few nights.
 */
export const REGRESSION_FROM_WEEKS = 10
export const REGRESSION_UNTIL_WEEKS = 24
/** Naps this short are one sleep cycle — the regression's daytime sign */
const ONE_CYCLE_NAP_MINUTES = 45

export type RegressionState = 'outside' | 'watching' | 'possible' | 'likely'

export interface RegressionWatch {
  state: RegressionState
  /** The changes that point to it, nights first */
  signs: PatternChange[]
}

export function regressionWatch(changes: PatternChange[], ageWeeks: number): RegressionWatch {
  const night = changes.filter(
    (c) =>
      (c.measure === 'nightWakings' && c.direction === 'up') ||
      (c.measure === 'longestNight' && c.direction === 'down') ||
      (c.measure === 'nightSleep' && c.direction === 'down'),
  )
  const naps = changes.filter(
    (c) => c.measure === 'napLength' && c.direction === 'down' && c.lately <= ONE_CYCLE_NAP_MINUTES,
  )
  const signs = [...night, ...naps]
  if (ageWeeks < REGRESSION_FROM_WEEKS || ageWeeks >= REGRESSION_UNTIL_WEEKS) {
    return { state: 'outside', signs }
  }
  if (night.length === 0) return { state: 'watching', signs: [] }
  return { state: night.length >= 2 || naps.length > 0 ? 'likely' : 'possible', signs }
}
