import type { FeedEntry, LogEntry } from './types'
import { findOpenSleep } from './log'
import { estimateByHour, estimateRecent, gapSamples, MIN_SAMPLES, MS_PER_MINUTE } from './patterns'

/**
 * When the next feed and the next change are likely, and how much she will
 * probably take.
 *
 * Everything here is read off her own last fortnight, never a chart of what a
 * baby that age "should" do, which is what makes it keep up as she grows. Two
 * different questions, answered two different ways, both settled by backtest
 * against eight weeks of real logs:
 *
 *  - *When.* How long she goes between feeds swings enormously across a day,
 *    so this is bucketed by hour (see `patterns.ts`): within about 37 minutes
 *    on a stretch that typically runs 1h50, against 53 for a flat average.
 *  - *How much.* A bottle is the same size at 3am as at 3pm — bucketing by
 *    hour changes nothing — so amounts are simply her recent median, within
 *    about 13 ml. Her own numbers climbed 25 → 70 ml over those eight weeks,
 *    which is the whole reason for a rolling window.
 *
 * Both are shown as "about", with the last one and her usual spread underneath,
 * because errors that size are a nudge and not a timetable.
 */

/** Entries closer together than this are one feed or one change, not two */
const SAME_EVENT_MINUTES = 45
/** A stretch longer than this is missing data, not a habit */
const MAX_GAP_MINUTES = 8 * 60
/** How far back to learn from — a fortnight won the backtest for all of it */
const HISTORY_DAYS = 14
/** Within this much of her usual stretch, it is coming up rather than a while off */
const SOON_MINUTES = 20
/** This close, "in about 4 minutes" is a false precision; it is simply about now */
const DUE_MINUTES = 5
/** Past her usual stretch by this much, "about now" becomes overdue */
const LATE_MINUTES = 30
/** Amounts are rounded to this, the way a bottle is actually made up */
const SERVING_STEP = 5

export type NeedKind = 'feed' | 'nappy'
/** Where she is in her usual stretch: a while to go, nearly there, about now, past it */
export type NeedState = 'settled' | 'soon' | 'due' | 'late'

/** How much she has been taking: millilitres from a bottle, or minutes at the breast */
export interface Serving {
  unit: 'ml' | 'min'
  value: number
}

export interface Need {
  kind: NeedKind
  state: NeedState
  /** When the next one is expected */
  at: Date
  /** Minutes until then; negative once it is past */
  dueIn: number
  /** Minutes since the last one was logged */
  since: number
  /** Her usual stretch at this hour, with the quartiles either side of it */
  usual: number
  shortest: number
  longest: number
  /** Feeds only, and only once there is a clear enough pattern to say */
  serving?: Serving
  /** True when the hour bucket had to be widened — a rougher guess */
  approximate: boolean
}

export interface NeedsForecast {
  feed?: Need
  nappy?: Need
  /** True while she is asleep, which changes what to do about one that is due */
  asleep: boolean
  /** Set when there is not enough logged yet to say anything */
  reason?: string
}

/** When the next one is due, from how long she has been going lately at this hour */
function needFor(kind: NeedKind, times: string[], now: Date, serving?: Serving): Need | null {
  const parsed = times.map((t) => Date.parse(t)).filter((t) => Number.isFinite(t) && t <= now.getTime())
  if (parsed.length === 0) return null

  const samples = gapSamples(times, SAME_EVENT_MINUTES, MAX_GAP_MINUTES)
  // One or two stretches say nothing about a habit; wait until there is a shape.
  if (samples.length < MIN_SAMPLES) return null

  const lastAt = new Date(Math.max(...parsed))
  const since = (now.getTime() - lastAt.getTime()) / MS_PER_MINUTE
  // How long she has already gone narrows it down; beyond the cap the log has
  // simply not been kept up, and there is nothing sensible left to condition on.
  const estimated = estimateByHour(samples, lastAt, HISTORY_DAYS, Math.min(since, MAX_GAP_MINUTES))
  if (!estimated) return null

  const dueIn = estimated.value - since
  return {
    kind,
    state:
      dueIn > SOON_MINUTES
        ? 'settled'
        : dueIn > DUE_MINUTES
          ? 'soon'
          : dueIn > -LATE_MINUTES
            ? 'due'
            : 'late',
    at: new Date(lastAt.getTime() + estimated.value * MS_PER_MINUTE),
    dueIn,
    since,
    usual: estimated.value,
    shortest: estimated.low,
    longest: estimated.high,
    serving,
    approximate: estimated.approximate,
  }
}

/**
 * How much the next feed is likely to be. Whichever way she has been fed most
 * often lately is the one worth predicting — there is no use offering
 * millilitres to someone who nurses.
 */
function servingFor(feeds: FeedEntry[], now: Date): Serving | undefined {
  const bottles = feeds
    .filter((f) => typeof f.amountMl === 'number' && f.amountMl > 0)
    .map((f) => ({ at: new Date(f.time), value: f.amountMl! }))
  const nursing = feeds
    .filter((f) => f.kind === 'nursing')
    .map((f) => ({ at: new Date(f.time), value: (f.leftMinutes ?? 0) + (f.rightMinutes ?? 0) }))
    .filter((s) => s.value > 0)

  const usual = bottles.length >= nursing.length ? bottles : nursing
  const unit = bottles.length >= nursing.length ? 'ml' : 'min'
  const estimated = estimateRecent(usual, now, HISTORY_DAYS)
  if (!estimated || estimated.samples < MIN_SAMPLES) return undefined
  return { unit, value: Math.max(SERVING_STEP, Math.round(estimated.value / SERVING_STEP) * SERVING_STEP) }
}

export function forecastNeeds(log: LogEntry[], now = new Date()): NeedsForecast {
  const feeds = log.filter((e): e is FeedEntry => e.type === 'feed')
  const feed = needFor(
    'feed',
    feeds.map((e) => e.time),
    now,
    servingFor(feeds, now),
  )
  const nappy = needFor(
    'nappy',
    log.filter((e) => e.type === 'nappy').map((e) => e.time),
    now,
  )
  const asleep = Boolean(findOpenSleep(log))

  if (!feed && !nappy) {
    return {
      asleep,
      reason: 'Log a few feeds and changes and this will start working out what is coming next.',
    }
  }
  return { feed: feed ?? undefined, nappy: nappy ?? undefined, asleep }
}
