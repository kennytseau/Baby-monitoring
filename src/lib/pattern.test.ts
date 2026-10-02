import { describe, expect, it } from 'vitest'
import { sleepPattern } from './pattern'
import type { LogEntry } from './types'

const NOW = new Date(2026, 8, 7, 18, 0)

let n = 0
function at(daysAgo: number, hour: number, minute = 0): string {
  const d = new Date(NOW)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}
function sleep(start: string, end?: string): LogEntry {
  n += 1
  return { id: `s${n}`, type: 'sleep', time: start, endTime: end }
}
function bottle(time: string, ml: number): LogEntry {
  n += 1
  return { id: `b${n}`, type: 'feed', kind: 'bottle', contents: 'formula', amountMl: ml, time }
}

describe('sleepPattern', () => {
  it('cuts a sleep over midnight into a piece on each day', () => {
    const rows = sleepPattern([sleep(at(1, 22), at(0, 4))], 3, NOW)
    expect(rows.map((r) => r.isToday)).toEqual([true, false])
    const [today, yesterday] = rows
    expect(yesterday.sleeps).toMatchObject([{ start: 22 * 60, end: 24 * 60 }])
    expect(today.sleeps).toMatchObject([{ start: 0, end: 4 * 60 }])
    expect(yesterday.asleepMinutes).toBe(120)
    expect(today.asleepMinutes).toBe(240)
    // The whole six hours counts as the longest stretch, on the day it began
    expect(yesterday.longestMinutes).toBe(360)
    expect(today.longestMinutes).toBe(0)
  })

  it('runs a sleep still going up to now, and leaves out one set ahead', () => {
    const rows = sleepPattern([sleep(at(0, 17)), sleep(at(0, 19), at(0, 20))], 1, NOW)
    expect(rows[0].sleeps).toMatchObject([{ start: 17 * 60, end: 18 * 60, open: true }])
  })

  it('counts a top-up as part of the same feed', () => {
    const rows = sleepPattern(
      [bottle(at(0, 9), 60), bottle(at(0, 9, 20), 30), bottle(at(0, 12), 90)],
      1,
      NOW,
    )
    expect(rows[0].feeds).toMatchObject([
      { at: 9 * 60, entries: 2, ml: 90 },
      { at: 12 * 60, entries: 1, ml: 90 },
    ])
  })

  it('starts at the first day anything was logged, keeping empty days after it', () => {
    const rows = sleepPattern([bottle(at(3, 9), 60)], 14, NOW)
    expect(rows).toHaveLength(4)
    expect(rows[1].feeds).toHaveLength(0)
    expect(rows[3].feeds).toHaveLength(1)
  })

  it('draws by the clock on the morning the clocks go forward', () => {
    // Sydney skips 2am–3am on 4 October 2026: 1am to 4am is two hours asleep
    const after = new Date(2026, 9, 4, 18, 0)
    const from = new Date(2026, 9, 4, 1, 0)
    const to = new Date(2026, 9, 4, 4, 0)
    const rows = sleepPattern([sleep(from.toISOString(), to.toISOString()), bottle(new Date(2026, 9, 4, 3, 0).toISOString(), 90)], 1, after)
    expect(rows[0].sleeps).toMatchObject([{ start: 60, end: 240 }])
    expect(rows[0].feeds).toMatchObject([{ at: 180 }])
    expect(rows[0].asleepMinutes).toBe((to.getTime() - from.getTime()) / 60_000)
  })

  it('has nothing to draw before anything is logged', () => {
    expect(sleepPattern([], 14, NOW)).toEqual([])
  })
})
