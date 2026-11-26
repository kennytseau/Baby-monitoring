/**
 * The clock she was living on when something happened.
 *
 * Every prediction compares her with herself at the same time of day. Read on
 * the phone's current clock, a fortnight logged in Sydney lands eleven hours
 * out after a flight to London: her 8:30pm bedtimes read as 9:30am. So each
 * entry records the time zone the phone was in when it was logged, and her
 * past is read on the clock of where it happened.
 *
 * That assumes she keeps her routine by the local clock wherever she is,
 * which is what travelling parents aim for. The jet-lagged first days stay
 * hard to call whatever the model.
 *
 * An entry with no zone (logged before zones were recorded, or synced from a
 * phone that does not record them) takes the zone of the nearest recorded
 * entry before it, or failing that the first one after. With no zones recorded
 * at all, the phone's own clock is used, exactly as before.
 */

const HOUR_MS = 60 * 60 * 1000
const DAY_MINUTES = 24 * 60

export interface Clock {
  /** Hour of the day (0–23) where she was at this moment */
  hourOf(at: Date): number
  /** Minutes into the day where she was at this moment */
  minuteOfDay(at: Date): number
  /** The zone she was in, when the log says; undefined when it never does */
  zoneAt(at: Date): string | undefined
}

/** The phone's own clock: what everything used before zones were recorded */
export const DEVICE_CLOCK: Clock = {
  hourOf: (at) => at.getHours(),
  minuteOfDay: (at) => at.getHours() * 60 + at.getMinutes(),
  zoneAt: () => undefined,
}

/** The time zone the phone is in now, e.g. "Australia/Sydney" */
export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>()
const offsets = new Map<string, number>()

/**
 * Minutes east of UTC in `zone` at this moment. Zones only change offset on
 * the hour, so the answer is kept per zone per hour: reading a few thousand
 * sleeps then costs a few thousand map lookups, not as many date formats.
 */
export function zoneOffsetMinutes(zone: string, at: Date): number {
  const hour = Math.floor(at.getTime() / HOUR_MS)
  const key = `${zone}|${hour}`
  let offset = offsets.get(key)
  if (offset === undefined) {
    offset = computeOffset(zone, new Date(hour * HOUR_MS))
    offsets.set(key, offset)
  }
  return offset
}

function computeOffset(zone: string, at: Date): number {
  try {
    let format = formatters.get(zone)
    if (!format) {
      format = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      })
      formatters.set(zone, format)
    }
    const part = (type: string) => Number(format!.formatToParts(at).find((p) => p.type === type)?.value)
    const wall = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour') % 24, part('minute'))
    return Math.round((wall - at.getTime()) / 60_000)
  } catch {
    // A zone this browser does not know: fall back to the phone's own offset
    return -at.getTimezoneOffset()
  }
}

const clocks = new WeakMap<object, Clock>()

/** Her clock, from the zones recorded in the log. The same log gives the same clock. */
export function clockFor(log: ReadonlyArray<{ time: string; tz?: string }>): Clock {
  const cached = clocks.get(log)
  if (cached) return cached

  const marks = log
    .filter((e) => e.tz)
    .map((e) => ({ at: Date.parse(e.time), tz: e.tz! }))
    .filter((m) => Number.isFinite(m.at))
    .sort((a, b) => a.at - b.at)
  if (marks.length === 0) {
    clocks.set(log, DEVICE_CLOCK)
    return DEVICE_CLOCK
  }

  const zoneAt = (at: Date): string => {
    const t = at.getTime()
    let low = 0
    let high = marks.length - 1
    let found = -1
    while (low <= high) {
      const mid = (low + high) >> 1
      if (marks[mid].at <= t) {
        found = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    return marks[found === -1 ? 0 : found].tz
  }
  const minuteOfDay = (at: Date): number => {
    const minutes = Math.floor(at.getTime() / 60_000) + zoneOffsetMinutes(zoneAt(at), at)
    return ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  }
  const clock: Clock = { zoneAt, minuteOfDay, hourOf: (at) => Math.floor(minuteOfDay(at) / 60) }
  clocks.set(log, clock)
  return clock
}

/**
 * True when this moment was logged on a different clock from the one the
 * phone is on now, so a day around it cannot be laid against today's. Zones
 * are compared by their offset, so Melbourne and Sydney count as the same
 * clock. Always false when the log records no zones.
 */
export function loggedElsewhere(clock: Clock, at: Date, here = deviceTimeZone()): boolean {
  const zone = clock.zoneAt(at)
  return !!zone && !!here && zone !== here && zoneOffsetMinutes(zone, at) !== zoneOffsetMinutes(here, at)
}
