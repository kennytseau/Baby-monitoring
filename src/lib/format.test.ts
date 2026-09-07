import { describe, expect, it } from 'vitest'
import { dateFromTimeInput, resolveLogTime, toTimeInput } from './format'

const NOW = new Date(2026, 8, 7, 8, 30)

describe('dateFromTimeInput', () => {
  it('reads a time earlier today', () => {
    const parsed = dateFromTimeInput('07:40', NOW)
    expect(parsed?.getDate()).toBe(7)
    expect(parsed?.getHours()).toBe(7)
    expect(parsed?.getMinutes()).toBe(40)
  })

  it('reads a time later than now as yesterday, so a bedtime typed after midnight works', () => {
    const parsed = dateFromTimeInput('23:50', new Date(2026, 8, 7, 0, 10))
    expect(parsed?.getDate()).toBe(6)
    expect(parsed?.getHours()).toBe(23)
  })

  it('accepts now itself', () => {
    expect(dateFromTimeInput('08:30', NOW)?.getTime()).toBe(NOW.getTime())
  })

  it('rejects anything that is not a real time', () => {
    for (const bad of ['', 'now', '8', '25:00', '10:75', '10-30']) {
      expect(dateFromTimeInput(bad, NOW)).toBeNull()
    }
  })

  it('round-trips through toTimeInput', () => {
    expect(dateFromTimeInput(toTimeInput(NOW), NOW)?.getTime()).toBe(NOW.getTime())
  })
})

describe('resolveLogTime', () => {
  it('is now when nothing is chosen', () => {
    expect(resolveLogTime({ offsetMinutes: 0 }, NOW).getTime()).toBe(NOW.getTime())
  })

  it('counts an offset back from the moment of saving', () => {
    const at = resolveLogTime({ offsetMinutes: 10 }, NOW)
    expect(NOW.getTime() - at.getTime()).toBe(10 * 60_000)
  })

  it('lets a typed time win over the offset', () => {
    const at = resolveLogTime({ offsetMinutes: 10, exactTime: '07:15' }, NOW)
    expect(at.getHours()).toBe(7)
    expect(at.getMinutes()).toBe(15)
  })

  it('falls back to the offset when the typed time is nonsense', () => {
    const at = resolveLogTime({ offsetMinutes: 5, exactTime: '99:99' }, NOW)
    expect(NOW.getTime() - at.getTime()).toBe(5 * 60_000)
  })

  it('never stamps an entry in the future', () => {
    expect(resolveLogTime({ offsetMinutes: -30 }, NOW).getTime()).toBe(NOW.getTime())
  })
})
