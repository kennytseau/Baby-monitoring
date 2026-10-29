import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  positiveNumber,
  resolveLogTime,
  toDatetimeInput,
  withPronouns,
} from './format'
import { AGE_BANDS } from '../data/milestones'

const NOW = new Date(2026, 8, 7, 8, 30)

describe('formatDuration', () => {
  it('never shows sixty minutes', () => {
    expect(formatDuration(119.9)).toBe('2 h')
    expect(formatDuration(59.6)).toBe('1 h')
    expect(formatDuration(95)).toBe('1 h 35 m')
    expect(formatDuration(0.4)).toBe('0 min')
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

  it('takes a picked date and time as it is, days back included', () => {
    const at = resolveLogTime({ offsetMinutes: 10, exactTime: '2026-10-27T20:46' }, NOW)
    expect(at.getTime()).toBe(new Date(2026, 9, 27, 20, 46).getTime())
  })

  it('falls back to the offset when the picked time is nonsense', () => {
    for (const bad of ['99:99', '2026-13-45T99:99']) {
      const at = resolveLogTime({ offsetMinutes: 5, exactTime: bad }, NOW)
      expect(NOW.getTime() - at.getTime()).toBe(5 * 60_000)
    }
  })

  it('never stamps an entry in the future', () => {
    expect(resolveLogTime({ offsetMinutes: -30 }, NOW).getTime()).toBe(NOW.getTime())
  })
})

describe('positiveNumber', () => {
  it('reads a number typed into a form', () => {
    expect(positiveNumber('90')).toBe(90)
    expect(positiveNumber('0.7')).toBe(0.7)
    expect(positiveNumber(' 120 ')).toBe(120)
  })

  it('treats blank, nonsense and zero-or-less as nothing entered', () => {
    for (const bad of ['', '   ', 'abc', '0', '-5', 'NaN']) {
      expect(positiveNumber(bad)).toBeUndefined()
    }
  })
})

describe('toDatetimeInput', () => {
  it('formats a moment for a datetime-local field', () => {
    expect(toDatetimeInput(new Date(2026, 8, 7, 9, 5))).toBe('2026-09-07T09:05')
  })

  it('accepts an ISO string as well as a Date', () => {
    const iso = new Date(2026, 8, 7, 19, 45).toISOString()
    expect(toDatetimeInput(iso)).toBe('2026-09-07T19:45')
  })

  it('round-trips: the value it produces parses back to the same minute', () => {
    const at = new Date(2026, 8, 7, 23, 59)
    expect(new Date(toDatetimeInput(at)).getTime()).toBe(at.getTime())
  })
})

describe('withPronouns', () => {
  it('fills she/her or he/him/his, capitals included', () => {
    const text = '{He} lifts {his} head when you call {him}, all by {himself}. {His} turn.'
    expect(withPronouns(text, 'female')).toBe('She lifts her head when you call her, all by herself. Her turn.')
    expect(withPronouns(text, 'male')).toBe('He lifts his head when you call him, all by himself. His turn.')
  })

  it('leaves text without placeholders alone', () => {
    expect(withPronouns('A change in about 40 min {soon}', 'male')).toBe('A change in about 40 min {soon}')
  })

  it('reads every milestone right for a boy, with nothing left unfilled for either', () => {
    const texts = AGE_BANDS.flatMap((band) => [
      band.overview,
      ...band.milestones.flatMap((m) => [m.title, m.description, ...m.howToEncourage]),
    ])
    for (const text of texts) {
      expect(withPronouns(text, 'male')).not.toMatch(/\b(she|her|herself)\b/i)
      for (const sex of ['female', 'male'] as const) expect(withPronouns(text, sex)).not.toMatch(/\{\w+\}/)
    }
  })
})
