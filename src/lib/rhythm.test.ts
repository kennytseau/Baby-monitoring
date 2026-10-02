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
  it('can be narrowed to her last few days, for when her sleep has just changed', () => {
    // Ten days of 60 minute naps at 13:00, then four of 120 minutes
    const log: LogEntry[] = []
    for (let day = 5; day <= 14; day += 1) log.push(sleep(at(day, 13, 0), 60))
    for (let day = 1; day <= 4; day += 1) log.push(sleep(at(day, 13, 0), 120))
    const open = sleep(at(0, 13, 0), null)
    const minutes = (days?: number) =>
      (forecastRhythm([...log, open], NOW, days).wakeUp!.at.getTime() - at(0, 13, 0).getTime()) / 60_000
    expect(minutes()).toBe(60)
    expect(minutes(5)).toBe(120)
  })

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
    expect(wakeUp!.earliest.getTime()).toBeLessThan(wakeUp!.latest.getTime())
  })

  it('keeps the same wake-up time for the whole sleep, however long she stays down', () => {
    const history: LogEntry[] = []
    for (let day = 1; day <= 14; day += 1) history.push(sleep(at(day, 13, 0), 40 + (day % 5) * 10))
    const open = sleep(at(0, 13, 0), null)
    const times = [at(0, 13, 1), at(0, 13, 45), at(0, 14, 30), at(0, 16, 0)].map(
      (now) => forecastRhythm([...history, open], now).wakeUp!.at.getTime(),
    )
    expect(new Set(times).size).toBe(1)
  })

  it('leaves a missed wake-up time where it was rather than rolling it forward', () => {
    const history: LogEntry[] = []
    for (let day = 1; day <= 14; day += 1) history.push(sleep(at(day, 13, 0), 60))
    // Still asleep two hours into a nap she usually finishes in one.
    const { wakeUp } = forecastRhythm([...history, sleep(at(0, 13, 0), null)], at(0, 15, 0))
    expect(wakeUp!.at.getHours()).toBe(14)
    expect(wakeUp!.at.getMinutes()).toBe(0)
  })

  it('keeps the same wind-down time for the whole wake window', () => {
    const log = [...steadyHistory(), sleep(at(0, 13, 0), 60)] // woke 14:00
    const times = [at(0, 14, 5), at(0, 15, 0), at(0, 16, 0)].map(
      (now) => forecastRhythm(log, now).windDown!.at.getTime(),
    )
    expect(new Set(times).size).toBe(1)
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

describe('only what has happened', () => {
  it('ignores a sleep set for later when predicting', () => {
    const log = [...steadyHistory(), sleep(at(0, 13, 0), 60)]
    const withPlanned = [...log, sleep(at(0, 16, 0), null)] // NOW is 14:00
    expect(forecastRhythm(withPlanned, NOW)).toEqual(forecastRhythm(log, NOW))
  })

  it('keeps her asleep when her wake-up has been set for later', () => {
    const open = sleep(at(0, 13, 0), 90) // "woke" at 14:30, but NOW is 14:00
    const forecast = forecastRhythm([...steadyHistory(), open], NOW)
    expect(forecast.asleep).toBe(true)
    expect(forecast.wakeUp).toBeDefined()
  })

  it('switches to asleep the moment a sleep is saved, not at the next clock tick', () => {
    const justSaved = sleep(new Date(NOW.getTime() + 800), null)
    const forecast = forecastRhythm([...steadyHistory(), justSaved], NOW)
    expect(forecast.asleep).toBe(true)
  })
})

describe('after a short nap', () => {
  /**
   * A fortnight of mornings: a 9am nap, then a long wake window. On the
   * seven most recent days the nap was only a 10-minute catnap, and she went
   * back down in half the time.
   */
  function catnapHistory(catnapDays = 7): LogEntry[] {
    const log: LogEntry[] = []
    for (let day = 1; day <= 14; day += 1) {
      if (day <= catnapDays) {
        log.push(sleep(at(day, 9, 0), 10)) // up at 9:10
        log.push(sleep(at(day, 10, 25), 60)) // 75 min later
      } else {
        log.push(sleep(at(day, 9, 0), 60)) // up at 10:00
        log.push(sleep(at(day, 12, 30), 60)) // 150 min later
      }
    }
    return log
  }

  it('brings the next wind-down forward by as much as her own short naps have', () => {
    const log = [...catnapHistory(), sleep(at(0, 9, 0), 10)]
    const { windDown } = forecastRhythm(log, at(0, 9, 20))
    expect(windDown!.afterShortNap).toEqual({ napMinutes: 10, factor: 0.5 })
    expect(windDown!.at.getTime()).toBeLessThan(at(0, 10, 30).getTime())
  })

  it('leaves the wind-down alone after a proper nap', () => {
    const log = [...catnapHistory(), sleep(at(0, 9, 0), 60)]
    expect(forecastRhythm(log, at(0, 10, 10)).windDown!.afterShortNap).toBeUndefined()
  })

  it('does not adjust until there are enough past short naps to go on', () => {
    const log = [...catnapHistory(3), sleep(at(0, 9, 0), 10)]
    expect(forecastRhythm(log, at(0, 9, 20)).windDown!.afterShortNap).toBeUndefined()
  })

  it('keeps the shortened time fixed while she stays up', () => {
    const log = [...catnapHistory(), sleep(at(0, 9, 0), 10)]
    const times = [at(0, 9, 20), at(0, 10, 0), at(0, 11, 30)].map(
      (now) => forecastRhythm(log, now).windDown!.at.getTime(),
    )
    expect(new Set(times).size).toBe(1)
  })
})
