import type { LogEntry } from './types'
import { hasEnded, startedSleeps } from './log'
import { estimateByHour, MIN_SAMPLES, MS_PER_MINUTE, quantile, type Estimate, type Sample } from './patterns'

/**
 * Predicting the next wake-up and the next wind-down, from her own sleeps at
 * this time of day — see `patterns.ts` for how the estimate is made, and the
 * README for how well it does against her real log.
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
/**
 * Naps shorter than these end in a band of their own. A catnap is not real
 * rest: on her log, the wake window after one under 15 minutes runs about half
 * her usual, and after one of 15–25 minutes about seven-tenths.
 */
const CATNAP_MINUTES = 15
const SHORT_NAP_MINUTES = 25
/** Short naps are rare, so how much they shorten things is learned over longer */
const SHORT_NAP_HISTORY_DAYS = 42

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
  /** Set when the window was shortened because the sleep before it was only a short nap */
  afterShortNap?: { napMinutes: number; factor: number }
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
  const sleeps = startedSleeps(log, now)
  const blocks: SleepBlock[] = []
  for (const sleep of sleeps) {
    const start = new Date(sleep.time)
    // A wake-up time set ahead has not happened: she is still in this sleep.
    const woke = hasEnded(sleep, now)
    const open = !woke
    // A sleep saved this very second can start a moment after the clock the
    // screen is holding; it has still begun, so it runs from its own start.
    const end = woke ? new Date(sleep.endTime!) : new Date(Math.max(now.getTime(), start.getTime()))
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

/** How long she stayed awake between one sleep and the next */
function wakeWindowSamples(blocks: SleepBlock[]): Sample[] {
  const samples: Sample[] = []
  for (let i = 0; i < blocks.length - 1; i += 1) {
    const woke = blocks[i]
    if (woke.open || woke.minutes < MIN_BLOCK_MINUTES) continue
    const next = blocks[i + 1]
    const minutes = (next.start.getTime() - woke.end.getTime()) / MS_PER_MINUTE
    if (minutes <= 0 || minutes > MAX_WAKE_WINDOW_MINUTES) continue
    samples.push({ at: woke.end, value: minutes })
  }
  return samples
}

/** How long each sleep lasted */
function sleepLengthSamples(blocks: SleepBlock[]): Sample[] {
  return blocks
    .filter((b) => !b.open && b.minutes >= MIN_BLOCK_MINUTES)
    .map((b) => ({ at: b.start, value: b.minutes }))
}

/** Which kind of nap a sleep was, for the purpose of what comes after it */
function napBand(minutes: number): 'catnap' | 'short' | 'full' {
  return minutes < CATNAP_MINUTES ? 'catnap' : minutes < SHORT_NAP_MINUTES ? 'short' : 'full'
}

/**
 * How much shorter than usual she stays up after a nap like this one, as a
 * fraction of her usual wake window at that hour — read off her own past short
 * naps, and 1 (no change) after a full nap or when there are too few to go on.
 */
function afterNapFactor(blocks: SleepBlock[], napMinutes: number, from: Date): number {
  const band = napBand(napMinutes)
  if (band === 'full') return 1

  const usualSamples = wakeWindowSamples(blocks)
  const cutoff = from.getTime() - SHORT_NAP_HISTORY_DAYS * 24 * 60 * MS_PER_MINUTE
  const ratios: number[] = []
  for (let i = 0; i < blocks.length - 1; i += 1) {
    const nap = blocks[i]
    const next = blocks[i + 1]
    if (nap.open || napBand(nap.minutes) !== band) continue
    if (nap.end.getTime() >= from.getTime() || nap.end.getTime() < cutoff) continue
    const awake = (next.start.getTime() - nap.end.getTime()) / MS_PER_MINUTE
    if (awake <= 0 || awake > MAX_WAKE_WINDOW_MINUTES) continue
    // Her usual at that moment, from what came before it — never from itself.
    const usual = estimateByHour(usualSamples, new Date(nap.end.getTime() - 1), WAKE_WINDOW_HISTORY_DAYS)
    if (usual && usual.value > 0) ratios.push(awake / usual.value)
  }
  if (ratios.length < MIN_SAMPLES) return 1
  return Math.min(1, quantile(ratios.sort((a, b) => a - b), 0.5))
}

function scaled(estimated: Estimate, factor: number): Estimate {
  return {
    ...estimated,
    value: estimated.value * factor,
    low: estimated.low * factor,
    high: estimated.high * factor,
  }
}

function toPrediction(from: Date, estimated: Estimate): Prediction {
  const at = new Date(from.getTime() + estimated.value * MS_PER_MINUTE)
  return {
    at,
    earliest: new Date(from.getTime() + estimated.low * MS_PER_MINUTE),
    latest: new Date(from.getTime() + estimated.high * MS_PER_MINUTE),
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

  // Both predictions are made once, from the moment the sleep or the wake
  // window began, and then left alone. A time that keeps sliding forward as
  // she runs past it is no use to plan around; a fixed one that has been
  // passed says something — the card shows "any time now" instead.
  if (asleep) {
    const estimated = estimateByHour(sleepLengthSamples(blocks), current.start, SLEEP_LENGTH_HISTORY_DAYS)
    if (!estimated) {
      return { asleep, reason: 'Not enough sleeps logged yet to guess when she will wake.' }
    }
    return { asleep, wakeUp: toPrediction(current.start, estimated) }
  }

  const lastWoke = current.end
  const estimated = estimateByHour(wakeWindowSamples(blocks), lastWoke, WAKE_WINDOW_HISTORY_DAYS)
  if (!estimated) {
    return { asleep, reason: 'Not enough sleeps logged yet to guess her next wind-down.' }
  }
  // A catnap leaves her nearly as tired as before it, so the window that
  // follows is shorter — by as much as her own short naps have shown.
  const factor = afterNapFactor(blocks, current.minutes, lastWoke)
  if (factor < 1) {
    return {
      asleep,
      windDown: {
        ...toPrediction(lastWoke, scaled(estimated, factor)),
        afterShortNap: { napMinutes: current.minutes, factor },
      },
    }
  }
  return { asleep, windDown: toPrediction(lastWoke, estimated) }
}
