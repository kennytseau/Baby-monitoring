import { describe, expect, it } from 'vitest'
import { forecastNeeds } from './needs'
import type { LogEntry } from './types'

const DAY = 24 * 60 * 60_000
const NOW = new Date('2026-09-11T14:00:00')

let counter = 0
function feed(at: Date, amountMl = 90): LogEntry {
  return { id: `f${counter++}`, type: 'feed', time: at.toISOString(), kind: 'bottle', amountMl }
}
function nursed(at: Date, minutes: number): LogEntry {
  return { id: `f${counter++}`, type: 'feed', time: at.toISOString(), kind: 'nursing', leftMinutes: minutes }
}
function nappy(at: Date): LogEntry {
  return { id: `n${counter++}`, type: 'nappy', time: at.toISOString(), kind: 'wet' }
}
function sleep(at: Date, endAt?: Date): LogEntry {
  return { id: `s${counter++}`, type: 'sleep', time: at.toISOString(), endTime: endAt?.toISOString() }
}
const minutesAgo = (m: number, from = NOW) => new Date(from.getTime() - m * 60_000)

/** `days` days of feeds every `everyMinutes`, the most recent one `sinceMinutes` ago */
function history(everyMinutes: number, sinceMinutes: number, days = 7): LogEntry[] {
  const log: LogEntry[] = []
  for (let day = 0; day < days; day += 1) {
    for (let i = 0; i < 24 * 60 / everyMinutes; i += 1) {
      log.push(feed(new Date(NOW.getTime() - day * DAY - sinceMinutes * 60_000 - i * everyMinutes * 60_000)))
    }
  }
  return log
}

describe('forecastNeeds', () => {
  it('says nothing until there is a shape to her day', () => {
    const forecast = forecastNeeds([feed(minutesAgo(30)), nappy(minutesAgo(45))], NOW)
    expect(forecast.feed).toBeUndefined()
    expect(forecast.reason).toMatch(/what is coming next/)
  })

  it('learns her usual stretch and says when the next one is due', () => {
    const forecast = forecastNeeds(history(180, 30), NOW)
    expect(forecast.feed!.usual).toBeCloseTo(180, 0)
    expect(forecast.feed!.since).toBeCloseTo(30, 0)
    expect(forecast.feed!.dueIn).toBeCloseTo(150, 0)
    expect(forecast.feed!.at.getTime()).toBeCloseTo(NOW.getTime() + 150 * 60_000, -3)
    expect(forecast.feed!.state).toBe('settled')
  })

  it('predicts how much, rounded the way a bottle is made up', () => {
    const log = history(180, 30).map((e, i) => (e.type === 'feed' ? feed(new Date(e.time), i % 2 ? 68 : 72) : e))
    expect(forecastNeeds(log, NOW).feed!.serving).toEqual({ unit: 'ml', value: 70 })
  })

  it('follows the recent fortnight for the amount too, so growth shows', () => {
    const log: LogEntry[] = []
    for (let day = 0; day < 7; day += 1) {
      for (let i = 0; i < 8; i += 1) log.push(feed(new Date(NOW.getTime() - day * DAY - i * 180 * 60_000), 70))
    }
    for (let day = 20; day < 40; day += 1) {
      for (let i = 0; i < 8; i += 1) log.push(feed(new Date(NOW.getTime() - day * DAY - i * 180 * 60_000), 25))
    }
    expect(forecastNeeds(log, NOW).feed!.serving).toEqual({ unit: 'ml', value: 70 })
  })

  it('offers minutes at the breast, not millilitres, to a baby who mostly nurses', () => {
    const log: LogEntry[] = []
    for (let day = 0; day < 7; day += 1) {
      for (let i = 0; i < 8; i += 1) log.push(nursed(new Date(NOW.getTime() - day * DAY - i * 180 * 60_000), 22))
    }
    expect(forecastNeeds(log, NOW).feed!.serving).toEqual({ unit: 'min', value: 20 })
  })

  it('says nothing about the amount until there is enough to go on', () => {
    const log = history(180, 30).map((e) =>
      e.type === 'feed' ? { ...e, amountMl: undefined, kind: 'solids' as const } : e,
    )
    expect(forecastNeeds(log, NOW).feed!.serving).toBeUndefined()
  })

  it('moves through settled, soon and due as the stretch runs out', () => {
    const states = [30, 170, 190, 240].map((since) => forecastNeeds(history(180, since), NOW).feed!.state)
    expect(states).toEqual(['settled', 'soon', 'due', 'due'])
  })

  it('counts the time already waited, so the guess moves out rather than going stale', () => {
    // Gaps of two to four hours. Three hours in, the short ones are ruled out.
    const log: LogEntry[] = []
    let t = NOW.getTime() - 40 * 60_000
    for (let i = 0; i < 60; i += 1) {
      log.push(feed(new Date(t)))
      t -= (120 + (i % 5) * 30) * 60_000
    }
    const fresh = forecastNeeds(log, NOW).feed!
    const waited = forecastNeeds(log, new Date(NOW.getTime() + 180 * 60_000)).feed!
    expect(waited.usual).toBeGreaterThan(fresh.usual)
    expect(waited.dueIn).toBeGreaterThanOrEqual(0)
  })

  it('calls it late only once the log has plainly not been kept up', () => {
    expect(forecastNeeds(history(180, 9 * 60), NOW).feed!.state).toBe('late')
  })

  it('follows the recent fortnight, not the whole history', () => {
    // Two-hourly this week, four-hourly in the weeks before the fortnight window.
    const recent = history(120, 30, 7)
    const old: LogEntry[] = []
    for (let day = 15; day < 36; day += 1) {
      for (let i = 0; i < 6; i += 1) {
        old.push(feed(new Date(NOW.getTime() - day * DAY - i * 240 * 60_000)))
      }
    }
    expect(forecastNeeds([...recent, ...old], NOW).feed!.usual).toBeCloseTo(120, 0)
  })

  it('treats a top-up soon after a feed as part of the same feed', () => {
    const log = history(180, 30)
    const topUp = feed(minutesAgo(10))
    // The top-up must not read as a ten-minute stretch between feeds.
    expect(forecastNeeds([...log, topUp], NOW).feed!.usual).toBeCloseTo(180, 0)
  })

  it('counts nappies separately from feeds', () => {
    const log: LogEntry[] = []
    for (let i = 1; i <= 20; i += 1) log.push(nappy(minutesAgo(i * 150)))
    log.push(nappy(minutesAgo(160)))
    const forecast = forecastNeeds(log, NOW)
    expect(forecast.nappy!.usual).toBeCloseTo(150, 0)
    expect(forecast.nappy!.state).toBe('due')
    expect(forecast.feed).toBeUndefined()
  })

  it('knows she is asleep, which is what changes the advice', () => {
    const log = history(180, 240)
    expect(forecastNeeds(log, NOW).asleep).toBe(false)
    expect(forecastNeeds([...log, sleep(minutesAgo(40))], NOW).asleep).toBe(true)
    expect(forecastNeeds([...log, sleep(minutesAgo(90), minutesAgo(40))], NOW).asleep).toBe(false)
  })

  it('ignores a gap so long it is missing data rather than a habit', () => {
    // A fortnight away from the log should not become a nine-hour "usual stretch".
    const log = [...history(180, 30), feed(new Date(NOW.getTime() - 40 * DAY))]
    expect(forecastNeeds(log, NOW).feed!.usual).toBeCloseTo(180, 0)
  })
})

describe('only what has happened', () => {
  it('does not let a feed set for later become a stretch it learns from', () => {
    // Stretches of 4 h and 2 h alternating: the median sits right on the edge,
    // so one made-up 90-minute "stretch" into the future would drag it down.
    const past = [30, 270, 390, 630, 750, 990].map((m) => feed(minutesAgo(m)))
    const plain = forecastNeeds(past, NOW).feed!
    const withPlanned = forecastNeeds([...past, feed(minutesAgo(-60))], NOW).feed!
    expect(withPlanned.usual).toBe(plain.usual)
  })

  it('learns nothing from entries lined up for later', () => {
    const log = history(180, 30)
    const ahead = [feed(minutesAgo(-40)), feed(minutesAgo(-90)), nappy(minutesAgo(-20))]
    expect(forecastNeeds([...log, ...ahead], NOW)).toEqual(forecastNeeds(log, NOW))
  })

  it('does not treat a sleep set for later as her being asleep', () => {
    expect(forecastNeeds([...history(180, 30), sleep(minutesAgo(-30))], NOW).asleep).toBe(false)
  })
})
