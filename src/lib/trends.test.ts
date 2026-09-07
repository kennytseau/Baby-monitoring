import { describe, expect, it } from 'vitest'
import { comparedToUsual, dailySummaries, trendSeries } from './trends'
import type { LogEntry } from './types'

const NOW = new Date(2026, 8, 7, 18, 0)
const DAY = 24 * 60 * 60 * 1000

let n = 0
function at(daysAgo: number, hour: number, minute = 0): string {
  const d = new Date(NOW.getTime() - daysAgo * DAY)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}
function bottle(daysAgo: number, hour: number, ml: number): LogEntry {
  n += 1
  return { id: `b${n}`, type: 'feed', kind: 'bottle', contents: 'formula', amountMl: ml, time: at(daysAgo, hour) }
}
function sleep(daysAgo: number, hour: number, minutes: number): LogEntry {
  n += 1
  const start = at(daysAgo, hour)
  return {
    id: `s${n}`,
    type: 'sleep',
    time: start,
    endTime: new Date(new Date(start).getTime() + minutes * 60_000).toISOString(),
  }
}
function nappy(daysAgo: number, hour: number): LogEntry {
  n += 1
  return { id: `n${n}`, type: 'nappy', kind: 'wet', time: at(daysAgo, hour) }
}

describe('dailySummaries', () => {
  it('covers the requested days newest first, including days with nothing logged', () => {
    const summaries = dailySummaries([bottle(0, 9, 100)], 8, NOW)
    expect(summaries).toHaveLength(8)
    expect(summaries[0].isToday).toBe(true)
    expect(summaries[0].totals.bottleMl).toBe(100)
    expect(summaries[1].totals.bottleMl).toBe(0)
    expect(summaries.filter((s) => s.isToday)).toHaveLength(1)
  })

  it('splits daytime naps out of total sleep', () => {
    const log = [
      sleep(0, 2, 180), // overnight
      sleep(0, 10, 60), // nap
      sleep(0, 14, 45), // nap
      sleep(0, 20, 90), // evening, not a nap
    ]
    const [today] = dailySummaries(log, 1, NOW)
    expect(today.totals.sleepMinutes).toBe(375)
    expect(today.napMinutes).toBe(105)
    expect(today.naps).toBe(2)
  })
})

describe('trendSeries', () => {
  const log = [
    bottle(0, 9, 100),
    bottle(1, 9, 200),
    bottle(2, 9, 300),
    nappy(0, 8),
    nappy(1, 8),
  ]
  const summaries = dailySummaries(log, 3, NOW)

  it('reads oldest first, so it plots left to right', () => {
    const series = trendSeries(summaries, 'milk')
    expect(series.points.map((p) => p.value)).toEqual([300, 200, 100])
    expect(series.points[series.points.length - 1].isToday).toBe(true)
  })

  it('reports the spread across the window', () => {
    const series = trendSeries(summaries, 'milk')
    expect(series.min).toBe(100)
    expect(series.max).toBe(300)
    expect(series.average).toBe(200)
  })

  it('leaves today out of "usual", since a half-finished day would drag it down', () => {
    const series = trendSeries(summaries, 'milk')
    expect(series.today).toBe(100)
    expect(series.usual).toBe(250) // (300 + 200) / 2, today excluded
    expect(comparedToUsual(series)).toBe(-60)
  })

  it('has nothing to compare when there is no history', () => {
    const series = trendSeries(dailySummaries([bottle(0, 9, 100)], 1, NOW), 'milk')
    expect(comparedToUsual(series)).toBeNull()
  })

  it('counts nappies as well as millilitres', () => {
    expect(trendSeries(summaries, 'nappies').points.map((p) => p.value)).toEqual([0, 1, 1])
  })
})

describe('comparing a part-finished day', () => {
  it('measures today against the same time of day, not against whole days', () => {
    // Yesterday: 100ml in the morning, 900ml after the current hour.
    // Today: 100ml in the morning. She is on track, not 80% down.
    const log = [bottle(1, 8, 100), bottle(1, 21, 900), bottle(0, 8, 100)]
    const whole = dailySummaries(log, 2, NOW)
    const byNow = dailySummaries(log, 2, NOW, true)
    expect(trendSeries(whole, 'milk').usual).toBe(1000)
    expect(trendSeries(whole, 'milk', byNow).usualByNow).toBe(100)
    expect(comparedToUsual(trendSeries(whole, 'milk', byNow))).toBe(0)
    // Without the correction it would read as a 90% shortfall
    expect(comparedToUsual(trendSeries(whole, 'milk'))).toBe(-90)
  })

  it('clips a sleep that straddles the cutoff rather than dropping it', () => {
    // 3 hours from 17:00 yesterday, of which one hour falls before 18:00
    const [, yesterday] = dailySummaries([sleep(1, 17, 180)], 2, NOW, true)
    expect(yesterday.totals.sleepMinutes).toBe(60)
  })

  it('leaves whole past days alone when no cutoff is asked for', () => {
    const [, yesterday] = dailySummaries([sleep(1, 17, 180)], 2, NOW)
    expect(yesterday.totals.sleepMinutes).toBe(180)
  })
})
