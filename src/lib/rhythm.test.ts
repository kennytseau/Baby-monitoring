import { describe, expect, it } from 'vitest'
import { forecastRhythm, sleepBlocks } from './rhythm'
import type { LogEntry } from './types'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(2026, 8, 7, 14, 0)

let counter = 0
function sleep(start: Date, minutes: number | null): LogEntry {
  counter += 1
  return {
    id: `s${counter}`,
    type: 'sleep',
    time: start.toISOString(),
    endTime: minutes === null ? undefined : new Date(start.getTime() + minutes * 60_000).toISOString(),
  }
}
function at(daysAgo: number, hour: number, minute = 0): Date {
  return new Date(NOW.getTime() - daysAgo * DAY + (hour - NOW.getHours()) * 3600_000 + minute * 60_000)
}

/** Two weeks of a steady rhythm: a 60 min nap at 13:00, awake 90 min, another at 15:30 */
function steadyHistory(): LogEntry[] {
  const log: LogEntry[] = []
  for (let day = 1; day <= 14; day += 1) {
    log.push(sleep(at(day, 13, 0), 60))
    log.push(sleep(at(day, 15, 30), 45))
  }
  return log
}

describe('sleepBlocks', () => {
  it('merges a stir that resettles within a quarter of an hour', () => {
    const blocks = sleepBlocks([sleep(at(0, 9, 0), 40), sleep(at(0, 9, 50), 30)], NOW)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].minutes).toBe(80)
  })

  it('keeps sleeps that are properly apart separate', () => {
    const blocks = sleepBlocks([sleep(at(0, 9, 0), 40), sleep(at(0, 10, 30), 30)], NOW)
    expect(blocks).toHaveLength(2)
  })

  it('runs an unfinished sleep up to now', () => {
    const blocks = sleepBlocks([sleep(at(0, 13, 0), null)], NOW)
    expect(blocks[0].open).toBe(true)
    expect(blocks[0].minutes).toBe(60)
  })
})

describe('forecastRhythm', () => {
  it('says nothing useful until there is history', () => {
    const forecast = forecastRhythm([], NOW)
    expect(forecast.wakeUp).toBeUndefined()
    expect(forecast.windDown).toBeUndefined()
    expect(forecast.reason).toBeTruthy()
  })

  it('predicts when she will wake from the nap she is in', () => {
    const log = [...steadyHistory(), sleep(at(0, 13, 0), null)]
    const { asleep, wakeUp } = forecastRhythm(log, NOW)
    expect(asleep).toBe(true)
    // 14 naps of 60 min starting at 13:00 → wake at 14:00
    expect(wakeUp?.at.getHours()).toBe(14)
    expect(wakeUp?.at.getMinutes()).toBe(0)
    expect(wakeUp?.approximate).toBe(false)
    expect(wakeUp?.samples).toBeGreaterThanOrEqual(5)
  })

  it('predicts the next wind-down from how long she usually stays awake', () => {
    const log = [...steadyHistory(), sleep(at(0, 13, 0), 60)]
    const { asleep, windDown } = forecastRhythm(log, NOW)
    expect(asleep).toBe(false)
    // woke 14:00, and the 14:00 wake windows in history are 90 min → 15:30
    expect(windDown?.at.getHours()).toBe(15)
    expect(windDown?.at.getMinutes()).toBe(30)
  })

  it('gives a range from the spread of past sleeps, not a bare time', () => {
    const log: LogEntry[] = []
    for (let day = 1; day <= 14; day += 1) {
      log.push(sleep(at(day, 13, 0), 40 + (day % 5) * 10))
    }
    log.push(sleep(at(0, 13, 0), null))
    const { wakeUp } = forecastRhythm(log, NOW)
    expect(wakeUp!.earliest.getTime()).toBeLessThan(wakeUp!.at.getTime())
    expect(wakeUp!.latest.getTime()).toBeGreaterThan(wakeUp!.at.getTime())
  })

  it('uses the hour of day, so a morning nap is not predicted from evening ones', () => {
    const log: LogEntry[] = []
    for (let day = 1; day <= 14; day += 1) {
      log.push(sleep(at(day, 9, 0), 120)) // long morning naps
      log.push(sleep(at(day, 19, 0), 30)) // short evening ones
    }
    log.push(sleep(at(0, 9, 0), null))
    const morning = forecastRhythm(log, new Date(at(0, 9, 30)))
    expect(morning.wakeUp?.at.getHours()).toBe(11)
  })

  it('falls back to a wider, flagged estimate when that hour is unfamiliar', () => {
    const log: LogEntry[] = []
    for (let day = 1; day <= 14; day += 1) log.push(sleep(at(day, 13, 0), 60))
    log.push(sleep(at(0, 4, 0), null)) // she has never napped at 4am
    const { wakeUp } = forecastRhythm(log, new Date(at(0, 4, 30)))
    expect(wakeUp).toBeDefined()
    expect(wakeUp?.approximate).toBe(true)
  })

  it('treats a stir-and-resettle as one sleep when predicting', () => {
    const log = [...steadyHistory(), sleep(at(0, 13, 0), 40), sleep(at(0, 13, 50), null)]
    const { asleep, wakeUp } = forecastRhythm(log, NOW)
    expect(asleep).toBe(true)
    // still measured from 13:00, the start of the whole sleep
    expect(wakeUp?.at.getHours()).toBe(14)
  })
})
