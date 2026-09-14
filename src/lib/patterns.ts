/**
 * Learning a baby's habits from her own log.
 *
 * One idea underpins every prediction in the app: a baby is far more
 * predictable by *time of day* than on average. How long she sleeps, how long
 * she stays awake, how long she goes between feeds — each varies enormously
 * across a day and much less at the same hour of different days.
 *
 * So the method is always the same. Take past events of one kind, keep only
 * the recent ones (habits move as she grows, so old ones are noise), bucket
 * them by the hour they happened, widen the bucket until there are enough to
 * be worth trusting, and take the median. The quartiles of that bucket give
 * the range to show alongside, which is the honest way to say "around 3pm"
 * without pretending to a precision that is not there.
 *
 * Backtested against eight weeks of real logs, hour-of-day bucketing roughly
 * halves the error of a single overall average for sleep, and cuts it by about
 * a third for the stretch between feeds and between nappies.
 */

/** Fewest samples in a bucket before it is trusted */
export const MIN_SAMPLES = 5
export const MS_PER_MINUTE = 60_000

export interface Sample {
  /** When it happened — gives it both an hour-of-day bucket and an age */
  at: Date
  /** What was measured: minutes for a stretch of time, millilitres for a bottle */
  value: number
}

export interface Estimate {
  value: number
  low: number
  high: number
  samples: number
  /** True when the bucket had to be widened or history exhausted — a rougher guess */
  approximate: boolean
}

/** Smallest number of hours between two hours of the day, going either way round the clock */
export function hoursApart(a: number, b: number): number {
  const diff = Math.abs(a - b) % 24
  return Math.min(diff, 24 - diff)
}

export function quantile(sorted: number[], fraction: number): number {
  if (sorted.length === 1) return sorted[0]
  const position = (sorted.length - 1) * fraction
  const low = Math.floor(position)
  const high = Math.ceil(position)
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low)
}

/**
 * The median of past stretches near this hour of the day, widening the bucket
 * and then dropping it altogether rather than refusing to answer.
 */
export function estimateByHour(samples: Sample[], from: Date, historyDays: number): Estimate | null {
  const recent = recentPool(samples, from, historyDays)
  const pool = recent.length > 0 ? recent : samples.filter((s) => s.at.getTime() <= from.getTime())
  if (pool.length === 0) return null

  const hour = from.getHours()
  for (const [width, approximate] of [
    [1, false],
    [2, true],
  ] as const) {
    const near = pool.filter((s) => hoursApart(s.at.getHours(), hour) <= width)
    if (near.length >= MIN_SAMPLES) {
      return summarize(near, approximate || recent.length === 0)
    }
  }
  return summarize(pool, true)
}

/**
 * The median of the recent past, with no regard for the hour.
 *
 * Not everything varies by time of day. Backtested on eight weeks of real
 * logs, *how much* she takes is the same at 3am as at 3pm — bucketing by hour
 * makes no difference to the error (13 ml either way for a bottle, 5 minutes
 * for a feed at the breast) — while *how long she goes between* feeds varies
 * enormously. So amounts use this and timings use `estimateByHour`.
 */
export function estimateRecent(samples: Sample[], from: Date, historyDays: number): Estimate | null {
  const pool = recentPool(samples, from, historyDays)
  return pool.length === 0 ? null : summarize(pool, false)
}

function recentPool(samples: Sample[], from: Date, historyDays: number): Sample[] {
  const cutoff = from.getTime() - historyDays * 24 * 60 * MS_PER_MINUTE
  return samples.filter((s) => s.at.getTime() >= cutoff && s.at.getTime() <= from.getTime())
}

function summarize(samples: Sample[], approximate: boolean): Estimate {
  const sorted = samples.map((s) => s.value).sort((a, b) => a - b)
  return {
    value: quantile(sorted, 0.5),
    low: quantile(sorted, 0.25),
    high: quantile(sorted, 0.75),
    samples: samples.length,
    approximate,
  }
}

/**
 * Collapse a stream of logged times into the events a parent would count, then
 * measure the stretches between them. Entries closer together than
 * `sameEventMinutes` are one event — a top-up bottle after a nursing session,
 * a second wipe after a change — and a stretch longer than `maxGapMinutes` is
 * missing data rather than a real habit.
 */
export function gapSamples(
  times: string[],
  sameEventMinutes: number,
  maxGapMinutes: number,
): Sample[] {
  const sorted = times.map((t) => Date.parse(t)).filter(Number.isFinite).sort((a, b) => a - b)
  const events: number[] = []
  for (const time of sorted) {
    const previous = events[events.length - 1]
    if (previous === undefined || (time - previous) / MS_PER_MINUTE >= sameEventMinutes) {
      events.push(time)
    }
  }
  const samples: Sample[] = []
  for (let i = 0; i < events.length - 1; i += 1) {
    const minutes = (events[i + 1] - events[i]) / MS_PER_MINUTE
    if (minutes > 0 && minutes <= maxGapMinutes) samples.push({ at: new Date(events[i]), value: minutes })
  }
  return samples
}
