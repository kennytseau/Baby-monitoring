import { describe, expect, it } from 'vitest'
import { DEVICE_CLOCK, clockFor, loggedElsewhere, zoneOffsetMinutes } from './clock'
import { forecastRhythm } from './rhythm'
import { usualBedtime } from './trends'
import type { LogEntry } from './types'

const SYDNEY = 'Australia/Sydney'
const LONDON = 'Europe/London'

/** The moment it is this wall-clock time in `zone` */
function wall(zone: string, month: number, day: number, hour: number, minute = 0): Date {
  const guess = Date.UTC(2026, month - 1, day, hour, minute)
  return new Date(guess - zoneOffsetMinutes(zone, new Date(guess)) * 60_000)
}

let n = 0
function sleep(zone: string, month: number, day: number, hour: number, minute: number, minutes?: number): LogEntry {
  n += 1
  const start = wall(zone, month, day, hour, minute)
  return {
    id: `s${n}`,
    type: 'sleep',
    time: start.toISOString(),
    endTime: minutes ? new Date(start.getTime() + minutes * 60_000).toISOString() : undefined,
    tz: zone,
  }
}

/** Her usual day on the local clock: three naps, bed at 7:30pm, up at 6am */
function usualDay(zone: string, month: number, day: number): LogEntry[] {
  return [
    sleep(zone, month, day, 9, 30, 60),
    sleep(zone, month, day, 13, 0, 90),
    sleep(zone, month, day, 16, 30, 45),
    sleep(zone, month, day, 19, 30, 630),
  ]
}

/** A fortnight in Sydney, then two days in London keeping the same local routine */
function trip(): LogEntry[] {
  const log: LogEntry[] = []
  for (let day = 1; day <= 14; day += 1) log.push(...usualDay(SYDNEY, 11, day))
  for (let day = 16; day <= 17; day += 1) log.push(...usualDay(LONDON, 11, day))
  return log
}

describe('zoneOffsetMinutes', () => {
  it('follows daylight saving in each zone', () => {
    expect(zoneOffsetMinutes(SYDNEY, new Date('2026-07-01T00:00:00Z'))).toBe(600)
    expect(zoneOffsetMinutes(SYDNEY, new Date('2026-12-01T00:00:00Z'))).toBe(660)
    expect(zoneOffsetMinutes(LONDON, new Date('2026-07-01T00:00:00Z'))).toBe(60)
    expect(zoneOffsetMinutes(LONDON, new Date('2026-12-01T00:00:00Z'))).toBe(0)
  })
})

describe('clockFor', () => {
  it('reads each moment on the clock of where it was logged', () => {
    const clock = clockFor(trip())
    expect(clock.hourOf(wall(SYDNEY, 11, 5, 19, 30))).toBe(19)
    expect(clock.hourOf(wall(LONDON, 11, 17, 19, 30))).toBe(19)
    expect(clock.minuteOfDay(wall(LONDON, 11, 17, 6, 15))).toBe(6 * 60 + 15)
  })

  it('gives entries without a zone the zone of the nearest one that has it', () => {
    const untagged: LogEntry = { id: 'old', type: 'nappy', kind: 'wet', time: wall(SYDNEY, 10, 20, 8).toISOString() }
    const clock = clockFor([untagged, ...trip()])
    expect(clock.zoneAt(new Date(untagged.time))).toBe(SYDNEY)
    expect(clock.hourOf(new Date(untagged.time))).toBe(8)
  })

  it('is the phone clock when the log records no zones', () => {
    expect(clockFor([{ time: '2026-11-01T00:00:00Z' }])).toBe(DEVICE_CLOCK)
  })

  it('knows a day logged on another clock, but not one on the same clock', () => {
    const clock = clockFor(trip())
    const sydneyDay = wall(SYDNEY, 11, 5, 12)
    expect(loggedElsewhere(clock, sydneyDay, LONDON)).toBe(true)
    expect(loggedElsewhere(clock, sydneyDay, SYDNEY)).toBe(false)
    expect(loggedElsewhere(clock, sydneyDay, 'Australia/Melbourne')).toBe(false)
    expect(loggedElsewhere(DEVICE_CLOCK, sydneyDay, LONDON)).toBe(false)
  })
})

describe('after a flight to London', () => {
  const minutesAfter = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 60_000

  it('still expects a night-length sleep from a 7:30pm bedtime', () => {
    const bedtime = wall(LONDON, 11, 18, 19, 30)
    const log = [...trip(), { ...sleep(LONDON, 11, 18, 19, 30), endTime: undefined }]
    const forecast = forecastRhythm(log, new Date(bedtime.getTime() + 60_000))
    expect(forecast.asleep).toBe(true)
    expect(minutesAfter(bedtime, forecast.wakeUp!.at)).toBeCloseTo(630, -1)
  })

  it('expects her usual 2-hour stretch after the 1pm nap', () => {
    const log = [...trip(), sleep(LONDON, 11, 18, 9, 30, 60), sleep(LONDON, 11, 18, 13, 0, 90)]
    const woke = wall(LONDON, 11, 18, 14, 30)
    const forecast = forecastRhythm(log, new Date(woke.getTime() + 60_000))
    expect(minutesAfter(woke, forecast.windDown!.at)).toBeCloseTo(120, -1)
  })

  it('keeps her usual bedtime at 7:30pm on the local clock', () => {
    const bed = usualBedtime(trip(), wall(LONDON, 11, 18, 15))!
    expect([bed.getHours(), bed.getMinutes()]).toEqual([19, 30])
  })
})
