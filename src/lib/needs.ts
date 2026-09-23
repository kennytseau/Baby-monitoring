import type { LogEntry } from './types'
import { findOpenSleep, happenedBy } from './log'
import { estimate, gapSamples, MIN_SAMPLES, MS_PER_MINUTE } from './patterns'

/**
 * "Should I feed her? Should I change her?"
 *
 * Both answers come from the same place: how long she usually goes between
 * feeds, and between changes, *at this hour of the day* — see `patterns.ts`.
 * Nothing here is a rule about babies in general; it is only ever her own last
 * fortnight, which is what makes it keep up as she grows. Backtested on eight
 * weeks of real logs it lands within about 37 minutes on a stretch between
 * feeds that typically runs 1h50, and about 44 minutes on a stretch between
 * changes that typically runs 3h — so the honest way to show it is a window,
 * never a time.
 */

/** Entries closer together than this are one feed or one change, not two */
const SAME_EVENT_MINUTES = 45
/** A stretch longer than this is missing data, not a habit */
const MAX_GAP_MINUTES = 8 * 60
/** How far back to learn from — a fortnight won the backtest for both */
const HISTORY_DAYS = 14
/** Within this much of her usual stretch, it is coming up rather than a while off */
const SOON_MINUTES = 20
/** Past her usual stretch by this much, "about now" becomes "overdue" */
const LATE_MINUTES = 30

export type NeedKind = 'feed' | 'nappy'
/** Where she is in her usual stretch: a while to go, nearly there, about now, past it */
export type NeedState = 'settled' | 'soon' | 'due' | 'late'

export interface Need {
  kind: NeedKind
  state: NeedState
  /** Minutes since the last one was logged */
  since: number
  /** Her usual stretch at this hour, with the quartiles either side of it */
  usual: number
  shortest: number
  longest: number
  /** Minutes until it is due; negative once it is past */
  dueIn: number
  /** True when the hour bucket had to be widened — a rougher guess */
  approximate: boolean
}

export interface NeedsForecast {
  feed?: Need
  nappy?: Need
  /** True while she is asleep, which changes what to do about a need that is due */
  asleep: boolean
  /** Set when there is not enough logged yet to say anything */
  reason?: string
}

/** Where she is in her usual stretch for one kind of thing */
function needFor(kind: NeedKind, times: string[], now: Date): Need | null {
  const parsed = times.map((t) => Date.parse(t)).filter((t) => Number.isFinite(t) && t <= now.getTime())
  if (parsed.length === 0) return null

  const samples = gapSamples(times, SAME_EVENT_MINUTES, MAX_GAP_MINUTES)
  // One or two stretches say nothing about a habit; wait until there is a shape.
  if (samples.length < MIN_SAMPLES) return null

  const lastAt = new Date(Math.max(...parsed))
  const estimated = estimate(samples, lastAt, HISTORY_DAYS)
  if (!estimated) return null

  const since = (now.getTime() - lastAt.getTime()) / MS_PER_MINUTE
  const dueIn = estimated.minutes - since
  return {
    kind,
    state:
      dueIn > SOON_MINUTES ? 'settled' : dueIn > 0 ? 'soon' : dueIn > -LATE_MINUTES ? 'due' : 'late',
    since,
    usual: estimated.minutes,
    shortest: estimated.lowMinutes,
    longest: estimated.highMinutes,
    dueIn,
    approximate: estimated.approximate,
  }
}

export function forecastNeeds(allEntries: LogEntry[], now = new Date()): NeedsForecast {
  // Only what has actually happened: a feed lined up for later is not a feed.
  const log = happenedBy(allEntries, now)
  const feed = needFor(
    'feed',
    log.filter((e) => e.type === 'feed').map((e) => e.time),
    now,
  )
  const nappy = needFor(
    'nappy',
    log.filter((e) => e.type === 'nappy').map((e) => e.time),
    now,
  )
  const asleep = Boolean(findOpenSleep(log, now))

  if (!feed && !nappy) {
    return {
      asleep,
      reason: 'Log a few feeds and changes and this will start learning how long she usually goes.',
    }
  }
  return { feed: feed ?? undefined, nappy: nappy ?? undefined, asleep }
}
