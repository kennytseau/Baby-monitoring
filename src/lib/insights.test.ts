import { describe, expect, it } from 'vitest'
import { herWeek } from './insights'
import { guidesForAge } from '../data/age-guides'
import type { GrowthEntry, LogEntry } from './types'

const NOW = new Date(2026, 9, 2, 14, 0)

let n = 0
function at(daysAgo: number, hour: number, minute = 0): Date {
  const d = new Date(NOW)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d
}
function sleep(daysAgo: number, hour: number, minutes: number): LogEntry {
  n += 1
  const start = at(daysAgo, hour)
  return {
    id: `s${n}`,
    type: 'sleep',
    time: start.toISOString(),
    endTime: new Date(start.getTime() + minutes * 60_000).toISOString(),
  }
}
function bottle(daysAgo: number, hour: number, ml: number): LogEntry {
  n += 1
  return { id: `b${n}`, type: 'feed', kind: 'bottle', contents: 'formula', amountMl: ml, time: at(daysAgo, hour).toISOString() }
}
function wet(daysAgo: number, hour: number): LogEntry {
  n += 1
  return { id: `n${n}`, type: 'nappy', kind: 'wet', time: at(daysAgo, hour).toISOString() }
}

/** A steady day: two naps, a night sleep, four bottles, six wet nappies */
function day(daysAgo: number): LogEntry[] {
  return [
    sleep(daysAgo, 1, 240),
    sleep(daysAgo, 9, 60),
    sleep(daysAgo, 13, 90),
    ...[6, 10, 14, 18].map((h) => bottle(daysAgo, h, 100)),
    ...[7, 9, 11, 15, 17, 21].map((h) => wet(daysAgo, h)),
  ]
}

describe('herWeek', () => {
  it('averages the last seven whole days, leaving today out', () => {
    const log = [1, 2, 3, 4, 5, 6, 7].flatMap(day).concat(day(0))
    const week = herWeek(log, [], NOW)
    expect(week.days).toBe(7)
    expect(week.values.sleep).toBe(390)
    expect(week.values.feeds).toBe(4)
    expect(week.values.naps).toBe(2)
    expect(week.values.wet).toBe(6)
    expect(week.values.bottle).toBe(400)
    expect(week.alsoNursed).toBe(false)
    // Woke 05:00 → 09:00, 10:00 → 13:00, 14:30 → 01:00 next day (too long, missing data)
    expect(week.values.wake).toBe(210)
  })

  it('does not count a day with no sleep logged as a day without sleep', () => {
    const feedsOnly = [6, 10, 14, 18].map((h) => bottle(1, h, 100))
    const log = [...[2, 3, 4, 5, 6, 7].flatMap(day), ...feedsOnly]
    const week = herWeek(log, [], NOW)
    expect(week.values.sleep).toBe(390)
    expect(week.values.feeds).toBe(4)
  })

  it('says nothing from fewer than three logged days', () => {
    const week = herWeek([1, 2].flatMap(day), [], NOW)
    expect(week.days).toBe(2)
    expect(week.values).toEqual({})
  })

  it('works out weight gain from readings far enough apart', () => {
    const growth: GrowthEntry[] = [
      { id: 'g1', date: '2026-08-21', weightKg: 4.0 },
      { id: 'g2', date: '2026-09-04', weightKg: 4.3 },
      { id: 'g3', date: '2026-09-25', weightKg: 4.75 },
    ]
    const week = herWeek([], growth, NOW)
    expect(week.latestWeightKg).toBe(4.75)
    // 4 Sep → 25 Sep: 450 g over three weeks
    expect(week.values.weight).toBe(150)
  })
})

describe('guidesForAge', () => {
  it('picks the band for her age', () => {
    const at12Weeks = guidesForAge(2.8)
    expect(at12Weeks.find((g) => g.id === 'sleep')?.text).toBe('14–17 h')
    expect(at12Weeks.find((g) => g.id === 'feeds')?.text).toBe('7–9 nursing, 6–8 by bottle')
    expect(at12Weeks.find((g) => g.id === 'wake')?.text).toBe('60–90 min')
    expect(guidesForAge(5).find((g) => g.id === 'sleep')?.text).toBe('12–16 h')
  })

  it('turns the formula guide into millilitres once she has a weight', () => {
    expect(guidesForAge(2.8, 5).find((g) => g.id === 'bottle')?.text).toBe('750–1000 ml at 5 kg')
    expect(guidesForAge(2.8).find((g) => g.id === 'bottle')?.range).toBeUndefined()
    expect(guidesForAge(7).find((g) => g.id === 'bottle')).toBeUndefined()
  })
})

describe('predictions', () => {
  it('never read the age guides', async () => {
    const sources = import.meta.glob(['./*.ts', '!./*.test.ts'], { query: '?raw', import: 'default', eager: true })
    const readers = Object.entries(sources)
      .filter(([, text]) => (text as string).includes('age-guides'))
      .map(([file]) => file)
    expect(readers).toEqual(['./insights.ts'])
  })
})
