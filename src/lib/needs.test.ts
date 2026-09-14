import { describe, expect, it } from 'vitest'
import { forecastNeeds } from './needs'
import type { LogEntry } from './types'

const DAY = 24 * 60 * 60_000
const NOW = new Date('2026-09-11T14:00:00')

let counter = 0
function feed(at: Date): LogEntry {
  return { id: `f${counter++}`, type: 'feed', time: at.toISOString(), kind: 'bottle', amountMl: 90 }
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
    expect(forecast.reason).toMatch(/start learning/)
  })

  it('learns her usual stretch and counts down to the next one', () => {
    const forecast = forecastNeeds(history(180, 30), NOW)
    expect(forecast.feed!.usual).toBeCloseTo(180, 0)
    expect(forecast.feed!.since).toBeCloseTo(30, 0)
    expect(forecast.feed!.dueIn).toBeCloseTo(150, 0)
    expect(forecast.feed!.state).toBe('settled')
  })

  it('moves through settled, soon, due and late as the stretch runs out', () => {
    const states = [30, 170, 190, 240].map((since) => forecastNeeds(history(180, since), NOW).feed!.state)
    expect(states).toEqual(['settled', 'soon', 'due', 'late'])
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
