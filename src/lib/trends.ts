import type { FeedEntry, LogEntry, SleepEntry } from './types'
import { dayTotals, dayWindow, entriesWithin, happenedBy, sleepMinutesWithin } from './log'
import type { DayTotals } from './log'
import { parseISODate, toISODate } from './age'
import { formatDuration, formatTime } from './format'
import { feedEvents } from './needs'
import { MIN_SAMPLES, MS_PER_MINUTE, quantile } from './patterns'
import { forecastRhythm, sleepBlocks } from './rhythm'

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

/* ---------- Catching up ---------- */

/** How many past days "her usual by now" is read from */
const CATCH_UP_DAYS = 7
/** Fewer logged days than this and there is no usual to be behind */
const MIN_USUAL_DAYS = 4
/**
 * Milk tips from midday until bedtime nears. Earlier, one feed given a little
 * late reads as a bottle behind: replayed on her log, most morning flags were that.
 */
const MILK_FROM_HOUR = 12
const MILK_UNTIL_HOUR = 20
/**
 * Behind by at least this much, and this share of her usual, before it is
 * worth saying. On her log to 22 November, at 3pm this flagged 6 days in 24,
 * and on most of them she ended the day short too, so it is not just a late start.
 */
const MILK_BEHIND_ML = 60
const MILK_BEHIND_SHARE = 0.2
/** Nursing this much longer than usual may already be making up the bottles */
const NURSING_AHEAD_MINUTES = 15
/** Smaller than these, a top-up or an extra feed is not worth suggesting */
const MIN_TOP_UP_ML = 20
const MIN_EXTRA_FEED_ML = 30
/** Her biggest usual bottle: this quantile of her feeds over the last fortnight */
const BIGGEST_BOTTLE_QUANTILE = 0.9
const BOTTLE_HISTORY_DAYS = 14
/** Day sleep this far behind her usual by now; flagged 3–4 days in 24 on her log */
const DAY_SLEEP_BEHIND_MINUTES = 40
/** A nap shorter than this is about one sleep cycle; shorter than the floor, a doze */
const ONE_CYCLE_MINUTES = 30
const MIN_NAP_MINUTES = 10
/** Her bedtime: the first sleep of at least this long that starts in the evening */
const NIGHT_SLEEP_MINUTES = 3 * 60
const BEDTIME_FROM_HOUR = 17
const BEDTIME_HISTORY_DAYS = 14
/** The next sleep counts as bedtime when it falls within this much of her usual bedtime */
const BEDTIME_MARGIN_MINUTES = 60
/** An earlier bedtime moves by half the shortfall, within these bounds */
const EARLIER_BED_MIN = 15
const EARLIER_BED_MAX = 30

export type CatchUpKind = 'milk' | 'extraNap' | 'longerNap' | 'earlyBed'

export interface CatchUpTip {
  kind: CatchUpKind
  /** The line to show, with pronoun placeholders */
  text: string
}

const DAY_MS = 24 * 60 * MS_PER_MINUTE
const median = (xs: number[]) => quantile([...xs].sort((a, b) => a - b), 0.5)
const roundTo = (value: number, step: number) => Math.round(value / step) * step
/** "Around" a time means to the nearest five minutes, not 12:16 */
const around = (at: Date) => formatTime(new Date(roundTo(at.getTime(), 5 * MS_PER_MINUTE)))

/**
 * Where today is behind her own usual by this time of day, and a way to make
 * it up: milk, an extra or longer nap, or an earlier bedtime.
 *
 * Being behind is read from her log. What to do about it is common advice,
 * not learned from her: on her log to 22 November, a day of less milk or
 * less day sleep did not go on to shorten her night, so the app has no
 * evidence of its own to go on.
 */
export function catchUpTips(log: LogEntry[], now = new Date()): CatchUpTip[] {
  const byNow = dailySummaries(log, CATCH_UP_DAYS + 1, now, true)
  const whole = dailySummaries(log, CATCH_UP_DAYS + 1, now)
  // A day with nothing logged is a gap in the record, not a day of nothing
  const past = byNow.slice(1).filter((_, i) => whole[i + 1].totals.feeds + whole[i + 1].totals.sleeps > 0)
  if (past.length < MIN_USUAL_DAYS) return []
  const milk = milkTip(log, now, byNow[0], past)
  return [...(milk ? [milk] : []), ...sleepTips(log, now, byNow[0], past)]
}

function milkTip(log: LogEntry[], now: Date, today: DaySummary, past: DaySummary[]): CatchUpTip | undefined {
  if (now.getHours() < MILK_FROM_HOUR || now.getHours() >= MILK_UNTIL_HOUR) return undefined
  const usual = median(past.map((s) => s.totals.bottleMl))
  const behind = usual - today.totals.bottleMl
  if (usual <= 0 || behind < MILK_BEHIND_ML || behind < usual * MILK_BEHIND_SHARE) return undefined
  const usualNursing = median(past.map((s) => s.totals.nursingMinutes))
  if (today.totals.nursingMinutes >= usualNursing + NURSING_AHEAD_MINUTES) return undefined

  const shortfall = roundTo(behind, 10)
  const lead = `Milk is about ${shortfall} ml behind {his} usual by now (${today.totals.bottleMl} ml so far, usually ${roundTo(usual, 10)}).`
  const nursingNote = usualNursing > 0 ? ' A long feed at the breast covers some of it too.' : ''

  const feeds = feedEvents(happenedBy(log, now).filter((e): e is FeedEntry => e.type === 'feed'))
  const bottles = feeds
    .filter((e) => e.ml > 0 && now.getTime() - e.at.getTime() <= BOTTLE_HISTORY_DAYS * DAY_MS)
    .map((e) => e.ml)
    .sort((a, b) => a - b)
  if (bottles.length < MIN_SAMPLES) {
    return { kind: 'milk', text: `${lead} An extra feed before bed is one way to make it up.${nursingNote}` }
  }
  const typical = roundTo(quantile(bottles, 0.5), 5)
  const biggest = roundTo(quantile(bottles, BIGGEST_BOTTLE_QUANTILE), 5)
  // How many more bottles she usually has from this time of day to midnight
  const left = Math.round(
    median(
      past.map((s) => {
        const from = parseISODate(s.day)
        from.setHours(now.getHours(), now.getMinutes(), 0, 0)
        const to = dayWindow(s.day).to
        return feeds.filter((e) => e.ml > 0 && e.at >= from && e.at < to).length
      }),
    ),
  )
  // Top up the bottles still to come as far as her biggest usual bottle, and
  // offer an extra feed for whatever that cannot carry.
  const room = Math.floor((biggest - typical) / 10) * 10
  const each = left > 0 ? Math.min(room, Math.ceil(behind / left / 10) * 10) : 0
  const rest = roundTo(behind - each * left, 10)
  const topUp = `add about ${each} ml to ${left === 1 ? '{his} next bottle' : `each of {his} next ${left} bottles`} (about ${typical + each} ml; {his} biggest usual is ${biggest} ml)`
  const how =
    each < MIN_TOP_UP_ML
      ? `{He} rarely takes more than ${biggest} ml at once, so an extra feed of about ${Math.min(shortfall, typical)} ml, say before bed, is the easier way to catch up.`
      : rest < MIN_EXTRA_FEED_ML
        ? `To make up ${rest > 0 ? 'most of it' : 'it'}, ${topUp}.`
        : `To make it up, ${topUp}, and offer an extra feed of about ${Math.min(rest, typical)} ml before bed.`
  // More than an extra feed can carry: say so rather than promise it all back
  const leftOver = (each < MIN_TOP_UP_ML ? shortfall : rest) - typical
  const tooMuch = leftOver >= MILK_BEHIND_ML ? ` That still leaves about ${roundTo(leftOver, 10)} ml, more than one evening usually makes up, so don't push it.` : ''
  return { kind: 'milk', text: `${lead} ${how}${tooMuch}${nursingNote}` }
}

function sleepTips(log: LogEntry[], now: Date, today: DaySummary, past: DaySummary[]): CatchUpTip[] {
  const forecast = forecastRhythm(log, now)
  const bedtime = usualBedtime(log, now)
  if (forecast.asleep || !forecast.windDown || !bedtime || now >= bedtime) return []
  const next = forecast.windDown.at
  const nextIsBedtime = next.getTime() >= bedtime.getTime() - BEDTIME_MARGIN_MINUTES * MS_PER_MINUTE
  const tips: CatchUpTip[] = []

  const behind = median(past.map((s) => s.napMinutes)) - today.napMinutes
  if (behind >= DAY_SLEEP_BEHIND_MINUTES) {
    const short = formatDuration(roundTo(behind, 5))
    if (nextIsBedtime) {
      const earlier = Math.min(EARLIER_BED_MAX, Math.max(EARLIER_BED_MIN, roundTo(behind / 2, 5)))
      const at = new Date(bedtime.getTime() - earlier * MS_PER_MINUTE)
      tips.push({
        kind: 'earlyBed',
        // Already due down before that? Then the wind-down above is the earlier bedtime.
        text:
          next.getTime() <= at.getTime()
            ? `Day sleep is about ${short} short of {his} usual, so put {him} down when {he}'s ready, around ${around(next)}, rather than holding out for {his} usual ${around(bedtime)}.`
            : `Day sleep is about ${short} short of {his} usual, so an earlier bedtime may help: around ${around(at)} instead of {his} usual ${around(bedtime)}.`,
      })
    } else {
      tips.push({
        kind: 'extraNap',
        text: `Day sleep is about ${short} behind {his} usual by now. ${
          next.getTime() <= now.getTime() ? '{His} next nap is due now, so try not to let it slip' : `Try not to let {his} next nap (around ${around(next)}) slip`
        }; a pram or carrier nap counts if you're out. If bedtime still looks a long way off after it, a short extra catnap can bridge the gap.`,
      })
    }
  }

  const blocks = sleepBlocks(log, now)
  const last = blocks[blocks.length - 1]
  const hour = last?.start.getHours() ?? -1
  const oneCycle = last && !last.open && last.minutes >= MIN_NAP_MINUTES && last.minutes < ONE_CYCLE_MINUTES
  if (last && oneCycle && hour >= NAP_START_HOUR && hour < NAP_END_HOUR && !nextIsBedtime) {
    tips.push({
      kind: 'longerNap',
      text: `{His} last nap was only ${formatDuration(last.minutes)}, about one sleep cycle. For the next one, if {he} stirs around the half-hour mark, try resettling {him} before getting {him} up; a dark, quiet spot helps {him} link cycles.`,
    })
  }
  return tips
}

/**
 * Her usual bedtime, as today's date: the median start of the first long
 * evening sleep over the last fortnight.
 */
export function usualBedtime(log: LogEntry[], now = new Date()): Date | undefined {
  const starts = new Map<string, number>()
  for (const block of sleepBlocks(log, now)) {
    if (block.open || block.minutes < NIGHT_SLEEP_MINUTES) continue
    if (now.getTime() - block.start.getTime() > BEDTIME_HISTORY_DAYS * DAY_MS) continue
    if (block.start.getHours() < BEDTIME_FROM_HOUR) continue
    const day = toISODate(block.start)
    if (!starts.has(day)) starts.set(day, block.start.getHours() * 60 + block.start.getMinutes())
  }
  if (starts.size < MIN_USUAL_DAYS) return undefined
  const minutes = Math.round(median([...starts.values()]))
  const at = new Date(now)
  at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return at
}
