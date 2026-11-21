import { describe, expect, it } from 'vitest'
import { catchUpTips, comparedToUsual, dailySummaries, trendSeries, usualBedtime } from './trends'
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
    // NOW is 18:00, so the evening sleep goes on yesterday — today's 20:00 has
    // not happened yet and nothing should count it.
    const log = [
      sleep(0, 2, 180), // overnight
      sleep(0, 10, 60), // nap
      sleep(0, 14, 45), // nap
      sleep(1, 20, 90), // evening, not a nap
    ]
    const [today, yesterday] = dailySummaries(log, 2, NOW)
    expect(today.totals.sleepMinutes).toBe(285)
    expect(today.napMinutes).toBe(105)
    expect(today.naps).toBe(2)
    expect(yesterday.totals.sleepMinutes).toBe(90)
    expect(yesterday.napMinutes).toBe(0)
  })

  it('leaves a nap set for later out of the nap total too', () => {
    const [today] = dailySummaries([sleep(0, 10, 60), sleep(0, 18, 45)], 1, new Date(NOW.getTime() - 3 * 3600_000))
    expect(today.napMinutes).toBe(60)
    expect(today.naps).toBe(1)
  })

  it('leaves out an entry timed for later today', () => {
    const [today] = dailySummaries([bottle(0, 9, 100), bottle(0, 21, 120)], 1, NOW)
    expect(today.totals.bottleMl).toBe(100)
    expect(today.totals.bottles).toBe(1)
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

describe('days across midnight', () => {
  it('gives today the part of last night after midnight', () => {
    // 22:00 yesterday to 03:00 today
    const night: LogEntry = {
      id: 'night',
      type: 'sleep',
      time: at(1, 22),
      endTime: new Date(Date.parse(at(1, 22)) + 5 * 60 * 60_000).toISOString(),
    }
    const [today, yesterday] = dailySummaries([night], 2, NOW)
    expect(today.totals.sleepMinutes).toBe(180)
    expect(yesterday.totals.sleepMinutes).toBe(120)
  })

  it('compares a past day only up to this time of day, splitting a sleep at the cutoff', () => {
    // At 18:00, yesterday's 17:00–19:00 nap counts its first hour only
    const [, yesterday] = dailySummaries([sleep(1, 17, 120)], 2, NOW, true)
    expect(yesterday.totals.sleepMinutes).toBe(60)
    expect(yesterday.napMinutes).toBe(60)
  })
})

describe('catchUpTips', () => {
  function napAt(daysAgo: number, hour: number, minute: number, minutes: number): LogEntry {
    n += 1
    const start = at(daysAgo, hour, minute)
    return { id: `c${n}`, type: 'sleep', time: start, endTime: new Date(Date.parse(start) + minutes * 60_000).toISOString() }
  }
  function nursed(daysAgo: number, hour: number, minutes: number): LogEntry {
    n += 1
    return { id: `c${n}`, type: 'feed', kind: 'nursing', leftMinutes: minutes, time: at(daysAgo, hour) }
  }
  /** A week of the same day: bottles of 80 ml, with 120 ml at 3pm and 6pm, three naps, bed at 7:30pm */
  function usualWeek(): LogEntry[] {
    const log: LogEntry[] = []
    for (let d = 1; d <= 7; d += 1) {
      for (const [hour, ml] of [[6, 80], [9, 80], [12, 80], [15, 120], [18, 120], [21, 80]]) log.push(bottle(d, hour, ml))
      log.push(napAt(d, 9, 30, 60), napAt(d, 13, 0, 90), napAt(d, 16, 30, 45), napAt(d, 19, 30, 600))
    }
    return log
  }
  const on = (hour: number, minute = 0) => new Date(2026, 8, 7, hour, minute)
  const kinds = (log: LogEntry[], now: Date) => catchUpTips(log, now).map((t) => t.kind)

  it('finds her usual bedtime from the evening sleeps', () => {
    const bed = usualBedtime(usualWeek(), on(15))!
    expect([bed.getHours(), bed.getMinutes()]).toEqual([19, 30])
  })

  it('says nothing on a day that is going as usual', () => {
    const log = [...usualWeek(), bottle(0, 6, 80), bottle(0, 9, 80), bottle(0, 12, 80), napAt(0, 9, 30, 60), napAt(0, 13, 0, 90)]
    expect(kinds(log, on(15))).toEqual([])
  })

  it('spreads a milk shortfall over the bottles still to come, up to her biggest', () => {
    // 160 ml by 3pm against a usual 240: three bottles usually follow
    const log = [...usualWeek(), bottle(0, 6, 80), bottle(0, 9, 80), napAt(0, 9, 30, 60), napAt(0, 13, 0, 90)]
    const milk = catchUpTips(log, on(15)).find((t) => t.kind === 'milk')!
    expect(milk.text).toContain('about 80 ml behind {his} usual by now (160 ml so far, usually 240)')
    expect(milk.text).toContain('add about 30 ml to each of {his} next 3 bottles (about 110 ml; {his} biggest usual is 120 ml).')
    expect(milk.text).not.toContain('extra feed')
  })

  it('adds an extra feed for what the bottles cannot carry', () => {
    // 160 ml behind: three bottles take 40 ml more each at most, leaving 40
    const log = [...usualWeek(), bottle(0, 6, 80), napAt(0, 9, 30, 60), napAt(0, 13, 0, 90)]
    const milk = catchUpTips(log, on(15)).find((t) => t.kind === 'milk')!
    expect(milk.text).toContain('add about 40 ml to each of {his} next 3 bottles')
    expect(milk.text).toContain('and offer an extra feed of about 40 ml before bed')
  })

  it('suggests an extra feed when her bottles are already as big as she takes', () => {
    const log: LogEntry[] = usualWeek().map((e) => (e.type === 'feed' ? { ...e, amountMl: 100 } : e))
    log.push(bottle(0, 6, 100), bottle(0, 9, 100), napAt(0, 9, 30, 60), napAt(0, 13, 0, 90))
    const milk = catchUpTips(log, on(15)).find((t) => t.kind === 'milk')!
    expect(milk.text).toContain('rarely takes more than 100 ml at once, so an extra feed of about 100 ml')
    expect(milk.text).not.toContain('still leaves')
  })

  it('does not promise back more than an evening can make up', () => {
    // Nothing by 6pm against 360: top-ups and one extra feed carry 160 at most
    const log = [...usualWeek(), napAt(0, 9, 30, 60), napAt(0, 13, 0, 90), napAt(0, 16, 30, 45)]
    const milk = catchUpTips(log, on(18)).find((t) => t.kind === 'milk')!
    expect(milk.text).toContain('an extra feed of about 80 ml before bed. That still leaves about 200 ml')
  })

  it('leaves milk alone before midday, or when she has nursed longer than usual', () => {
    const log = [...usualWeek(), napAt(0, 9, 30, 60)]
    expect(kinds(log, on(11, 30))).not.toContain('milk')
    expect(kinds([...log, napAt(0, 13, 0, 90), nursed(0, 11, 30)], on(15))).not.toContain('milk')
  })

  it('suggests not missing the next nap when day sleep is behind and bedtime is a way off', () => {
    const log = [...usualWeek(), bottle(0, 6, 80), bottle(0, 9, 80), bottle(0, 12, 80), napAt(0, 9, 30, 30), napAt(0, 13, 0, 40)]
    const tips = catchUpTips(log, on(15))
    expect(tips.map((t) => t.kind)).toEqual(['extraNap'])
    expect(tips[0].text).toContain('about 1 h 20 m behind')
  })

  it('suggests an earlier bedtime when day sleep is behind and bed is next', () => {
    const log = [
      ...usualWeek(),
      ...[6, 9, 12, 15].map((h) => bottle(0, h, h >= 15 ? 120 : 80)),
      napAt(0, 9, 30, 30),
      napAt(0, 13, 0, 40),
      napAt(0, 16, 30, 20),
    ]
    const tips = catchUpTips(log, on(18))
    expect(tips.map((t) => t.kind)).toEqual(['earlyBed'])
    expect(tips[0].text).toMatch(/instead of \{his\} usual|rather than holding out for \{his\} usual/)
  })

  it('suggests stretching the next nap after a one-cycle nap, but not after a doze', () => {
    const log = [...usualWeek(), bottle(0, 6, 80), bottle(0, 9, 80)]
    expect(kinds([...log, napAt(0, 9, 30, 20)], on(10, 30))).toContain('longerNap')
    expect(kinds([...log, napAt(0, 9, 30, 5)], on(10, 30))).not.toContain('longerNap')
  })

  it('says nothing about sleep while she is asleep, or without a week to compare', () => {
    const asleep: LogEntry = { id: 'open', type: 'sleep', time: at(0, 13) }
    expect(kinds([...usualWeek(), napAt(0, 9, 30, 20), asleep], on(13, 30)).filter((k) => k !== 'milk')).toEqual([])
    expect(kinds([bottle(1, 9, 80), bottle(0, 9, 80)], on(15))).toEqual([])
  })
})
