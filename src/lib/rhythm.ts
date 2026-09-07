import type { LogEntry, SleepEntry } from './types'
import { sortedByTime } from './log'

/**
 * Predicting the next wake-up and the next wind-down.
 *
 * Both come from the same idea: a baby's sleep is far more predictable by time
 * of day than on average. Backtested against eight weeks of real logs, taking
 * the median of past events in the same hour-of-day bucket roughly halves the
 * error against a single overall average — about 16 minutes off for a wake
 * window and 21 for a nap length, versus 24 and 55.
 *
 * So: bucket past events by the hour they happened, widen the bucket until
 * there are enough of them, and take the median. The quartiles of the same
 * bucket give the range shown alongside, which is the honest way to say
 * "around 3pm" without pretending to a precision that is not there.
 */

/** Sleeps closer together than this are one sleep — she stirred and resettled */
const RESETTLE_GAP_MINUTES = 15
/** Anything shorter than this is a catnap in arms, not a sleep to predict from */
const MIN_BLOCK_MINUTES = 10
/** A gap longer than this is not a wake window, it is missing data */
const MAX_WAKE_WINDOW_MINUTES = 8 * 60
/** How far back each prediction looks — chosen by backtest, they differ */
const WAKE_WINDOW_HISTORY_DAYS = 21
const SLEEP_LENGTH_HISTORY_DAYS = 14
/** Fewest samples in a bucket before it is trusted */
const MIN_SAMPLES = 5
const MS_PER_MINUTE = 60_000

export interface Prediction {
  /** When it is expected to happen */
  at: Date
  /** Plausible range around it, from the quartiles of the same bucket */
  earliest: Date
  latest: Date
  /** How many past events this was drawn from */
  samples: number
  /** True when the bucket was widened or history exhausted, so it is a rougher guess */
  approximate: boolean
}

export interface RhythmForecast {
  /** She is asleep now: when she is likely to wake */
  wakeUp?: Prediction
  /** She is awake now: when she is likely to be ready for sleep */
  windDown?: Prediction
  /** True while she is asleep */
  asleep: boolean
  /** Set when there is not enough history yet to say anything */
  reason?: string
}

/** A continuous stretch of sleep, after resettles have been merged in */
export interface SleepBlock {
  start: Date
  end: Date
  minutes: number
  /** True while she is still in it */
  open: boolean
}

/**
 * Turn logged sleeps into the blocks a parent would recognise: a stir that ends
 * and restarts within a quarter of an hour is one sleep, not two.
 */
export function sleepBlocks(log: LogEntry[], now = new Date()): SleepBlock[] {
  const sleeps = sortedByTime(
    log.filter((e): e is SleepEntry => e.type === 'sleep'),
    'asc',
  )
  const blocks: SleepBlock[] = []
  for (const sleep of sleeps) {
    const start = new Date(sleep.time)
    const open = !sleep.endTime
    const end = sleep.endTime ? new Date(sleep.endTime) : now
    if (end.getTime() < start.getTime()) continue
    const previous = blocks[blocks.length - 1]
    if (
      previous &&
      !previous.open &&
      (start.getTime() - previous.end.getTime()) / MS_PER_MINUTE <= RESETTLE_GAP_MINUTES
    ) {
      previous.end = end > previous.end ? end : previous.end
      previous.minutes = (previous.end.getTime() - previous.start.getTime()) / MS_PER_MINUTE
      previous.open = open
      continue
    }
    blocks.push({ start, end, minutes: (end.getTime() - start.getTime()) / MS_PER_MINUTE, open })
  }
  return blocks
}

interface Sample {
  /** When the event started, used for its hour-of-day bucket and its recency */
  at: Date
  minutes: number
}

/** How long she stayed awake between one sleep and the next */
function wakeWindowSamples(blocks: SleepBlock[]): Sample[] {
  const samples: Sample[] = []
  for (let i = 0; i < blocks.length - 1; i += 1) {
    const woke = blocks[i]
    if (woke.open || woke.minutes < MIN_BLOCK_MINUTES) continue
    const next = blocks[i + 1]
    const minutes = (next.start.getTime() - woke.end.getTime()) / MS_PER_MINUTE
    if (minutes <= 0 || minutes > MAX_WAKE_WINDOW_MINUTES) continue
    samples.push({ at: woke.end, minutes })
  }
  return samples
}

/** How long each sleep lasted */
function sleepLengthSamples(blocks: SleepBlock[]): Sample[] {
  return blocks
    .filter((b) => !b.open && b.minutes >= MIN_BLOCK_MINUTES)
    .map((b) => ({ at: b.start, minutes: b.minutes }))
}

/** Smallest number of hours between two hours of the day, going either way round the clock */
function hoursApart(a: number, b: number): number {
  const diff = Math.abs(a - b) % 24
  return Math.min(diff, 24 - diff)
}

function quantile(sorted: number[], fraction: number): number {
  if (sorted.length === 1) return sorted[0]
  const position = (sorted.length - 1) * fraction
  const low = Math.floor(position)
  const high = Math.ceil(position)
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low)
}

interface Estimate {
  minutes: number
  lowMinutes: number
  highMinutes: number
  samples: number
  approximate: boolean
}

/**
 * The median of past events near this hour of the day, widening the bucket and
 * then dropping it altogether rather than refusing to answer.
 */
function estimate(samples: Sample[], from: Date, historyDays: number): Estimate | null {
  const cutoff = from.getTime() - historyDays * 24 * 60 * MS_PER_MINUTE
  const recent = samples.filter((s) => s.at.getTime() >= cutoff && s.at.getTime() <= from.getTime())
  const pool = recent.length > 0 ? recent : samples.filter((s) => s.at.getTime() <= from.getTime())
  if (pool.length === 0) return null

  const hour = from.getHours()
  for (const [width, approximate] of [
    [1, false],
    [2, true],
  ] as const) {
    const near = pool.filter((s) => hoursApart(s.at.getHours(), hour) <= width)
    if (near.length >= MIN_SAMPLES) {
      const sorted = near.map((s) => s.minutes).sort((a, b) => a - b)
      return {
        minutes: quantile(sorted, 0.5),
        lowMinutes: quantile(sorted, 0.25),
        highMinutes: quantile(sorted, 0.75),
        samples: near.length,
        approximate: approximate || recent.length === 0,
      }
    }
  }

  const sorted = pool.map((s) => s.minutes).sort((a, b) => a - b)
  return {
    minutes: quantile(sorted, 0.5),
    lowMinutes: quantile(sorted, 0.25),
    highMinutes: quantile(sorted, 0.75),
    samples: pool.length,
    approximate: true,
  }
}

function toPrediction(from: Date, estimated: Estimate): Prediction {
  const at = new Date(from.getTime() + estimated.minutes * MS_PER_MINUTE)
  return {
    at,
    earliest: new Date(from.getTime() + estimated.lowMinutes * MS_PER_MINUTE),
    latest: new Date(from.getTime() + estimated.highMinutes * MS_PER_MINUTE),
    samples: estimated.samples,
    approximate: estimated.approximate,
  }
}

/**
 * What to expect next: when she will wake if she is asleep, or when she will be
 * ready to go down if she is awake.
 */
export function forecastRhythm(log: LogEntry[], now = new Date()): RhythmForecast {
  const blocks = sleepBlocks(log, now)
  const current = blocks[blocks.length - 1]
  const asleep = !!current?.open

  if (blocks.length === 0) {
    return { asleep: false, reason: 'Log a few sleeps and this will start predicting her rhythm.' }
  }

  if (asleep) {
    const estimated = estimate(sleepLengthSamples(blocks), current.start, SLEEP_LENGTH_HISTORY_DAYS)
    if (!estimated) {
      return { asleep, reason: 'Not enough sleeps logged yet to guess when she will wake.' }
    }
    return { asleep, wakeUp: toPrediction(current.start, estimated) }
  }

  const lastWoke = current.end
  const estimated = estimate(wakeWindowSamples(blocks), lastWoke, WAKE_WINDOW_HISTORY_DAYS)
  if (!estimated) {
    return { asleep, reason: 'Not enough sleeps logged yet to guess her next wind-down.' }
  }
  return { asleep, windDown: toPrediction(lastWoke, estimated) }
}
