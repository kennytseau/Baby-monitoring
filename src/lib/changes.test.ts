import { describe, expect, it } from 'vitest'
import { dailyMeasures, patternChanges, regressionWatch, type PatternChange } from './changes'
import type { LogEntry } from './types'
import { toISODate } from './age'

const NOW = new Date(2026, 9, 2, 14, 0)

let n = 0
function at(daysAgo: number, hour: number, minute = 0): Date {
  const d = new Date(NOW)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d
}
function sleep(start: Date, minutes: number): LogEntry {
  n += 1
  return {
    id: `s${n}`,
    type: 'sleep',
    time: start.toISOString(),
    endTime: new Date(start.getTime() + minutes * 60_000).toISOString(),
  }
}
function bottle(start: Date): LogEntry {
  n += 1
  return { id: `b${n}`, type: 'feed', kind: 'bottle', contents: 'formula', amountMl: 90, time: start.toISOString() }
}

/** A settled day: bedtime 7:30pm for 5 h, two more sleeps, three naps, eight feeds */
function steady(daysAgo: number, wobble = 0): LogEntry[] {
  return [
    sleep(at(daysAgo + 1, 19, 30), 300 + wobble),
    sleep(at(daysAgo, 1, 0), 180),
    sleep(at(daysAgo, 4, 30), 120),
    sleep(at(daysAgo, 9, 0), 90 + wobble),
    sleep(at(daysAgo, 12, 30), 80),
    sleep(at(daysAgo, 16, 0), 60),
    ...[3, 6, 9, 12, 15, 18, 21, 23].map((h) => bottle(at(daysAgo, h))),
  ]
}

/** The regression's shape: nights in 90-minute pieces, naps of 35 minutes */
function broken(daysAgo: number): LogEntry[] {
  const night = [19.5, 21.5, 23.5, 25.5, 27.5].map((h) => {
    const start = new Date(at(daysAgo + 1, 0).getTime() + h * 60 * 60_000)
    return sleep(start, 90)
  })
  return [
    ...night,
    sleep(at(daysAgo, 9, 0), 35),
    sleep(at(daysAgo, 11, 30), 35),
    sleep(at(daysAgo, 14, 0), 35),
    sleep(at(daysAgo, 16, 30), 35),
    ...[3, 6, 9, 12, 15, 18, 21, 23].map((h) => bottle(at(daysAgo, h))),
  ]
}

function history(days: number, shape: (daysAgo: number) => LogEntry[], from = 1): LogEntry[] {
  return Array.from({ length: days }, (_, i) => shape(from + i)).flat()
}

describe('dailyMeasures', () => {
  it('reads a night from 7pm to 7am and the day from 7am to 7pm', () => {
    const days = dailyMeasures(steady(1), NOW)
    const day = days.find((d) => d.values.longestNight != null)!
    expect(day.values.longestNight).toBe(300)
    expect(day.values.nightWakings).toBe(2)
    expect(day.values.napLength).toBe(80)
    expect(day.values.feeds).toBe(8)
  })

  it('counts an early bedtime as the start of her night, not a nap', () => {
    const log = [
      sleep(at(2, 18, 20), 250), // 6:20pm to 10:30pm, mostly after 7pm
      sleep(at(1, 1, 0), 180),
      sleep(at(1, 9, 0), 60),
      sleep(at(1, 13, 0), 60),
      sleep(at(1, 16, 0), 60),
    ]
    // The night of 6:20pm two days ago, and the day after it
    const day = dailyMeasures(log, NOW).find((d) => d.day === toISODate(at(1, 12)))!
    expect(day.values.longestNight).toBe(250)
    expect(day.values.nightWakings).toBe(1)
    expect(day.values.napLength).toBe(60)
  })

  it('waits for a sleep still going at 7am before measuring the night', () => {
    const stillAsleep: LogEntry = { id: 'open', type: 'sleep', time: at(0, 5, 0).toISOString() }
    const log = [...steady(2), sleep(at(1, 19, 30), 200), stillAsleep]
    const today = (now: Date) => dailyMeasures(log, now).find((d) => d.day === toISODate(NOW))!
    expect(today(at(0, 7, 30)).values.longestNight).toBeUndefined()
    // Once she wakes at 8am, the whole night counts, the sleep she woke from included
    const woke: LogEntry = { ...stillAsleep, endTime: at(0, 8, 0).toISOString() }
    const night = dailyMeasures([...steady(2), sleep(at(1, 19, 30), 200), woke], at(0, 8, 30))
    expect(night.find((d) => d.day === toISODate(NOW))!.values.nightWakings).toBe(1)
  })

  it('does not measure today before it is over', () => {
    const all = dailyMeasures([...steady(1), ...steady(0)], NOW)
    const today = all[all.length - 1]
    expect(today.values.longestNight).toBe(300)
    expect(today.values.napLength).toBeUndefined()
    expect(today.values.feeds).toBeUndefined()
  })
})

describe('patternChanges', () => {
  it('stays quiet while her days look like her usual', () => {
    const log = history(20, (d) => steady(d, (d % 3) * 10))
    expect(patternChanges(dailyMeasures(log, NOW), NOW)).toEqual([])
  })

  it('does not call one bad night a change', () => {
    const log = [...history(19, (d) => steady(d, (d % 3) * 10), 2), ...broken(1)]
    expect(patternChanges(dailyMeasures(log, NOW), NOW)).toEqual([])
  })

  it('reports three days in a row past her usual spread', () => {
    const log = [...history(17, (d) => steady(d, (d % 3) * 10), 4), ...history(3, broken)]
    const changes = patternChanges(dailyMeasures(log, NOW), NOW)
    const of = (m: PatternChange['measure']) => changes.find((c) => c.measure === m)
    expect(of('longestNight')).toMatchObject({ direction: 'down', usual: 310, lately: 90 })
    expect(of('nightWakings')).toMatchObject({ direction: 'up', usual: 2, lately: 4 })
    expect(of('napLength')).toMatchObject({ direction: 'down', lately: 35 })
    expect(of('feeds')).toBeUndefined()
  })

  it('keeps measuring a change against the fortnight before it began', () => {
    // Ten days in, the broken nights would be most of a rolling fortnight
    const log = [...history(17, (d) => steady(d, (d % 3) * 10), 11), ...history(10, broken)]
    const measures = dailyMeasures(log, NOW)
    const longest = (days: number) =>
      patternChanges(measures, NOW, days).find((c) => c.measure === 'longestNight')
    expect(longest(42)).toMatchObject({ direction: 'down', usual: 310 })
    expect(longest(42)!.days).toHaveLength(10)
  })

  it('lets a change become her new normal after a fortnight', () => {
    const log = [...history(17, (d) => steady(d, (d % 3) * 10), 21), ...history(20, broken)]
    const measures = dailyMeasures(log, NOW)
    expect(patternChanges(measures, NOW).find((c) => c.measure === 'longestNight')).toBeUndefined()
    expect(patternChanges(measures, NOW, 42).find((c) => c.measure === 'longestNight')).toBeDefined()
  })

  it('ends when her last days are back inside her usual', () => {
    const log = [
      ...history(17, (d) => steady(d, (d % 3) * 10), 9),
      ...history(5, broken, 4),
      ...history(3, (d) => steady(d, (d % 3) * 10)),
    ]
    expect(patternChanges(dailyMeasures(log, NOW), NOW, 42)).toEqual([])
  })

  it('says nothing from a log that has gone quiet', () => {
    const log = [...history(17, (d) => steady(d, (d % 3) * 10), 7), ...history(3, broken, 4)]
    expect(patternChanges(dailyMeasures(log, NOW), NOW)).toEqual([])
  })
})

describe('regressionWatch', () => {
  const change = (measure: PatternChange['measure'], direction: 'up' | 'down', lately = 0): PatternChange => ({
    measure,
    direction,
    usual: 0,
    lately,
    days: [],
  })

  it('only names the regression inside the weeks it is commonly seen', () => {
    const signs = [change('nightWakings', 'up'), change('longestNight', 'down')]
    expect(regressionWatch(signs, 7).state).toBe('outside')
    expect(regressionWatch(signs, 14).state).toBe('likely')
    expect(regressionWatch(signs, 30).state).toBe('outside')
  })

  it('needs her nights to change before it says anything', () => {
    expect(regressionWatch([], 14).state).toBe('watching')
    expect(regressionWatch([change('napLength', 'down', 35)], 14).state).toBe('watching')
    expect(regressionWatch([change('feeds', 'up')], 14).state).toBe('watching')
  })

  it('is possible on one night sign and likely on two, or one with one-cycle naps', () => {
    expect(regressionWatch([change('nightWakings', 'up')], 14).state).toBe('possible')
    expect(
      regressionWatch([change('nightWakings', 'up'), change('napLength', 'down', 40)], 14).state,
    ).toBe('likely')
    expect(
      regressionWatch([change('nightWakings', 'up'), change('napLength', 'down', 60)], 14).state,
    ).toBe('possible')
    // Better nights are not a regression
    expect(regressionWatch([change('longestNight', 'up')], 14).state).toBe('watching')
  })
})


