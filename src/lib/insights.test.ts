import { describe, expect, it } from 'vitest'
import { estimatedWeight, herWeek } from './insights'
import { guidesForAge } from '../data/age-guides'
import type { GrowthEntry, LogEntry } from './types'
import { withPronouns } from './format'

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
    expect(week.values.daySleep).toBe(150)
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
  const text = (age: number, id: string, weightKg?: number) =>
    guidesForAge(age, weightKg).find((g) => g.id === id)?.text

  it('picks the band for her age', () => {
    expect(text(2.8, 'sleep')).toBe('14–17 h')
    expect(text(2.8, 'feeds')).toBe('8–12 nursing, 6–8 by bottle')
    expect(text(2.8, 'wake')).toBe('1–2.5 h')
    expect(text(2.8, 'daySleep')).toBeUndefined()
  })

  it('narrows month by month through the first year', () => {
    // Just past 4½ months
    expect(text(4.6, 'sleep')).toBe('14–15 h')
    expect(text(4.6, 'naps')).toBe('2–3 a day')
    expect(text(4.6, 'daySleep')).toBe('3–4 h')
    expect(text(4.6, 'wake')).toBe('2–2.5 h')
    expect(text(4.6, 'feeds')).toBe('About 5 by day and 1–2 overnight')
    // Six months
    expect(text(6, 'naps')).toBe('2–3 a day')
    expect(text(9.5, 'naps')).toBe('2 a day')
    expect(text(6, 'daySleep')).toBe('2–3 h')
    expect(text(6, 'wake')).toBe('2–3 h')
    expect(text(6, 'feeds')).toBe('4–6, alongside solids')
    // Seven months, then nine
    expect(text(7, 'sleep')).toBe('12–14 h')
    expect(text(9.5, 'wake')).toBe('2.5–3.5 h')
    // Into the second year
    expect(text(13, 'naps')).toBe('1–2 a day')
    expect(text(20, 'naps')).toBe('1 a day')
  })

  it('turns the formula guide into millilitres once she has a weight', () => {
    expect(text(2.8, 'bottle', 5)).toBe('About 750 ml at 5 kg')
    const perKg = text(2.8, 'bottle')!
    expect(withPronouns(perKg, 'female')).toBe('About 150 ml per kg of her weight')
    expect(withPronouns(perKg, 'male')).toBe('About 150 ml per kg of his weight')
    expect(text(7, 'bottle', 8)).toBe('720–800 ml at 8 kg')
    expect(text(13, 'bottle')).toBeUndefined()
  })

  it('follows the NHMRC drop to about 120 ml per kg from three months', () => {
    expect(text(4.5, 'bottle', 7.6)).toBe('About 910 ml at 7.6 kg')
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

describe('estimatedWeight', () => {
  // Made-up weigh-ins for a girl born 7 July
  const growth: GrowthEntry[] = [
    { id: 'g1', date: '2026-08-19', weightKg: 4.7 },
    { id: 'g2', date: '2026-09-03', weightKg: 5.3 },
    { id: 'g3', date: '2026-09-24', weightKg: 6.1 },
  ]
  const on = (iso: string) => new Date(`${iso}T12:00:00`)

  it('ranges between staying on her percentile and keeping up her recent gain', () => {
    const estimate = estimatedWeight(growth, '2026-07-07', 'female', on('2026-10-16'))!
    expect(estimate.fromKg).toBe(6.1)
    expect(estimate.low).toBeGreaterThan(6.5) // her percentile, about 6.6
    expect(estimate.low).toBeLessThan(6.7)
    // 4.7 → 6.1 over 36 days, carried on for 22 more
    expect(estimate.high).toBeCloseTo(6.1 + ((6.1 - 4.7) / 36) * 22.5, 1)
  })

  it('follows her percentile alone when there is no recent gain to go on', () => {
    const estimate = estimatedWeight([growth[2]], '2026-07-07', 'female', on('2026-10-16'))!
    expect(estimate.low).toBe(estimate.high)
  })

  it('says nothing just after a weigh-in, or long after one', () => {
    expect(estimatedWeight(growth, '2026-07-07', 'female', on('2026-09-25'))).toBeUndefined()
    expect(estimatedWeight(growth, '2026-07-07', 'female', on('2026-12-01'))).toBeUndefined()
    expect(estimatedWeight([], '2026-07-07', 'female', on('2026-10-16'))).toBeUndefined()
  })

  it('reads as an estimate in the formula guide', () => {
    expect(guidesForAge(3.3, 6.9, true).find((g) => g.id === 'bottle')!.text).toBe('About 830 ml at 6.9 kg (estimated weight)')
    expect(guidesForAge(3.3, 6.1).find((g) => g.id === 'bottle')!.text).toBe('About 730 ml at 6.1 kg')
  })
})
