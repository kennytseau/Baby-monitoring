import { describe, expect, it } from 'vitest'
import { dateFromTimeInput, toTimeInput } from './format'

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
