import type { FeedEntry, LogEntry } from './types'
import { happenedBy, nursingMinutes, sortedByTime } from './log'
import { sleepBlocks } from './rhythm'
import { SAME_EVENT_MINUTES } from './needs'
import { MS_PER_MINUTE } from './patterns'
import { toISODate } from './age'
import { minutesIntoDay } from './format'

/**
 * Her days stacked one above the other on the same 24-hour line, so a rhythm
 * shows up as sleep lining up down the page. Read-only: nothing here feeds a
 * prediction.
 */

const DAY_MINUTES = 24 * 60

export interface PatternSleep {
  /** Minutes past midnight on this row; a sleep over midnight is cut in two */
  start: number
  end: number
  /** The whole sleep, for the details line */
  from: Date
  to: Date
  /** True while she is still in it */
  open: boolean
}

export interface PatternFeed {
  /** Minutes past midnight */
  at: number
  time: Date
  /** Entries within a feed of each other count as one: a top-up is the same feed */
  entries: number
  ml: number
  nursingMinutes: number
}

export interface PatternDay {
  /** ISO day, YYYY-MM-DD */
  day: string
  isToday: boolean
  sleeps: PatternSleep[]
  feeds: PatternFeed[]
  /** Asleep between this midnight and the next */
  asleepMinutes: number
  /** The longest sleep that began on this day, whole even if it ran past midnight */
  longestMinutes: number
}

function midnightOf(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function nextMidnight(date: Date): Date {
  const d = midnightOf(date)
  d.setDate(d.getDate() + 1)
  return d
}

/**
 * Where a moment sits on its row: by the clock, like the daily strip, so on the
 * morning the clocks change a 3am feed is still drawn at 3am. The next
 * midnight is the end of the row.
 */
function clockOnRow(at: Date, rowEnd: Date): number {
  return at.getTime() >= rowEnd.getTime() ? DAY_MINUTES : minutesIntoDay(at)
}

/**
 * The last `days` days, today first, each with its sleeps cut at midnight and
 * its feeds. Only what has happened is drawn — a sleep still going runs to
 * now, and anything set ahead waits until its time. Days before the first
 * entry are left off; empty days after it stay, so a gap reads as a gap.
 */
export function sleepPattern(log: LogEntry[], days = 14, now = new Date()): PatternDay[] {
  const happened = happenedBy(log, now)
  if (happened.length === 0) return []
  const first = sortedByTime(happened, 'asc')[0]
  const firstDay = toISODate(new Date(first.time))
  const today = toISODate(now)

  const rows = new Map<string, PatternDay>()
  const order: string[] = []
  for (let back = 0; back < days; back += 1) {
    const date = new Date(now)
    date.setDate(date.getDate() - back)
    const day = toISODate(date)
    if (day < firstDay) break
    order.push(day)
    rows.set(day, {
      day,
      isToday: day === today,
      sleeps: [],
      feeds: [],
      asleepMinutes: 0,
      longestMinutes: 0,
    })
  }

  for (const block of sleepBlocks(happened, now)) {
    const startRow = rows.get(toISODate(block.start))
    if (startRow) startRow.longestMinutes = Math.max(startRow.longestMinutes, block.minutes)
    // Walk the midnights the sleep crosses, one piece per day
    let cursor = block.start
    while (cursor < block.end) {
      const until = nextMidnight(cursor)
      const pieceEnd = block.end < until ? block.end : until
      const row = rows.get(toISODate(cursor))
      if (row) {
        row.sleeps.push({
          start: clockOnRow(cursor, until),
          end: clockOnRow(pieceEnd, until),
          from: block.start,
          to: block.end,
          open: block.open,
        })
        // Time actually asleep, which on a clock-change night is not the bar's length
        row.asleepMinutes += (pieceEnd.getTime() - cursor.getTime()) / MS_PER_MINUTE
      }
      cursor = until
    }
  }

  const feeds = sortedByTime(
    happened.filter((e): e is FeedEntry => e.type === 'feed'),
    'asc',
  )
  let previous: PatternFeed | undefined
  for (const feed of feeds) {
    const time = new Date(feed.time)
    const ml = feed.amountMl && feed.amountMl > 0 ? feed.amountMl : 0
    const minutes = feed.kind === 'nursing' ? nursingMinutes(feed, now) : 0
    if (
      previous &&
      (time.getTime() - previous.time.getTime()) / MS_PER_MINUTE < SAME_EVENT_MINUTES
    ) {
      previous.entries += 1
      previous.ml += ml
      previous.nursingMinutes += minutes
      continue
    }
    const row = rows.get(toISODate(time))
    previous = { at: minutesIntoDay(time), time, entries: 1, ml, nursingMinutes: minutes }
    row?.feeds.push(previous)
  }

  return order.map((day) => rows.get(day)!)
}
