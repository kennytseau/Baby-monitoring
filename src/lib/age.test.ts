import { describe, expect, it } from 'vitest'
import { DAYS_PER_MONTH, adjustedAgeInDays, ageInCalendarMonths, ageInDays, ageInMonthsFloat, correctionDays, daysBetween, developmentalAgeMonths, formatAge, parseISODate, toISODate, usesAdjustedAge } from './age'

describe('parseISODate / toISODate', () => {
  it('round-trips a date', () => {
    expect(toISODate(parseISODate('2026-05-14'))).toBe('2026-05-14')
  })
  it('parses as local midnight', () => {
    const d = parseISODate('2026-05-14')
    expect(d.getHours()).toBe(0)
    expect(d.getDate()).toBe(14)
  })
})

describe('daysBetween / ageInDays', () => {
  it('counts calendar days regardless of time of day', () => {
    const from = new Date(2026, 4, 14, 23, 30)
    const to = new Date(2026, 4, 15, 0, 30)
    expect(daysBetween(from, to)).toBe(1)
  })
  it('computes age in days', () => {
    expect(ageInDays('2026-05-14', new Date(2026, 5, 14))).toBe(31)
  })
})

describe('ageInCalendarMonths', () => {
  it('is 0 before the first month-birthday', () => {
    expect(ageInCalendarMonths('2026-01-15', new Date(2026, 1, 14))).toBe(0)
  })
  it('increments on the month-birthday', () => {
    expect(ageInCalendarMonths('2026-01-15', new Date(2026, 1, 15))).toBe(1)
    expect(ageInCalendarMonths('2026-01-15', new Date(2026, 3, 20))).toBe(3)
  })
})

/** The month wording, as it will read once the family switches to it */
const MONTHS = 12 * 7

describe('birthdays late in the month', () => {
  it('never shows negative weeks', () => {
    expect(formatAge('2025-01-30', new Date(2026, 2, 1), MONTHS)).toBe('13 months old')
    expect(formatAge('2025-01-31', new Date(2026, 2, 1), MONTHS)).toBe('13 months old')
  })

  it('counts the last day of a short month as the monthly birthday', () => {
    expect(formatAge('2025-01-31', new Date(2025, 5, 30, 3, 22), MONTHS)).toBe('5 months old')
    expect(formatAge('2025-01-29', new Date(2026, 1, 28), MONTHS)).toBe('13 months old')
    expect(formatAge('2025-01-29', new Date(2026, 2, 7), MONTHS)).toBe('13 months, 1 week old')
  })

  it('still counts a mid-month birthday the ordinary way', () => {
    expect(formatAge('2026-07-07', new Date(2027, 0, 1, 3, 22), MONTHS)).toBe('5 months, 3 weeks old')
  })
})

describe('formatAge', () => {
  const birth = '2026-05-14'
  it('uses days for the first two weeks', () => {
    expect(formatAge(birth, new Date(2026, 4, 15))).toBe('1 day old')
    expect(formatAge(birth, new Date(2026, 4, 24))).toBe('10 days old')
  })
  it('stays in weeks until months are switched on', () => {
    // Born 7 July: 12 weeks, 2 days on 1 October.
    expect(formatAge('2026-07-07', new Date(2026, 9, 1, 3, 22))).toBe('12 weeks, 2 days old')
    expect(formatAge('2026-07-07', new Date(2026, 9, 27))).toBe('16 weeks old')
    expect(formatAge('2026-07-07', new Date(2027, 6, 9))).toBe('52 weeks, 3 days old')
  })

  it('uses weeks and days early on', () => {
    expect(formatAge(birth, new Date(2026, 5, 28))).toBe('6 weeks, 3 days old')
    expect(formatAge(birth, new Date(2026, 5, 25))).toBe('6 weeks old')
  })
  it('uses months and weeks up to 24 months', () => {
    expect(formatAge(birth, new Date(2026, 11, 14), MONTHS)).toBe('7 months old')
    expect(formatAge(birth, new Date(2026, 11, 30), MONTHS)).toBe('7 months, 2 weeks old')
  })
  it('uses years and months after 24 months', () => {
    expect(formatAge(birth, new Date(2028, 7, 20), MONTHS)).toBe('2 years, 3 months old')
  })
})

describe('adjusted age for premature babies', () => {
  const profile = { name: 'Test', birthDate: '2026-05-14', sex: 'female' as const, dueDate: '2026-06-11' }
  it('computes correction days from the due date', () => {
    expect(correctionDays(profile)).toBe(28)
  })
  it('subtracts the correction from actual age', () => {
    expect(adjustedAgeInDays(profile, new Date(2026, 6, 14))).toBe(61 - 28)
  })
  it('ignores due dates before birth (born late)', () => {
    expect(correctionDays({ ...profile, dueDate: '2026-05-01' })).toBe(0)
  })
})

describe('developmentalAgeMonths', () => {
  const born = (birthDate: string, dueDate?: string) => ({
    name: 'Madison',
    birthDate,
    sex: 'female' as const,
    dueDate,
  })
  const on = new Date(2026, 8, 8)

  it('uses her actual age when she was not early', () => {
    const profile = born('2026-07-15')
    expect(developmentalAgeMonths(profile, on)).toBeCloseTo(ageInMonthsFloat('2026-07-15', on), 6)
    expect(usesAdjustedAge(profile)).toBe(false)
  })

  it('ignores a correction under a fortnight, which is not worth applying', () => {
    const profile = born('2026-07-15', '2026-07-25') // ten days early
    expect(usesAdjustedAge(profile)).toBe(false)
    expect(developmentalAgeMonths(profile, on)).toBeCloseTo(ageInMonthsFloat('2026-07-15', on), 6)
  })

  it('reads a properly early baby at her adjusted age', () => {
    const profile = born('2026-07-15', '2026-08-15') // a month early
    expect(usesAdjustedAge(profile)).toBe(true)
    const actual = ageInMonthsFloat('2026-07-15', on)
    const adjusted = developmentalAgeMonths(profile, on)
    expect(adjusted).toBeLessThan(actual)
    expect(actual - adjusted).toBeCloseTo(31 / DAYS_PER_MONTH, 6)
  })

  it('applies the threshold exactly at the boundary', () => {
    expect(usesAdjustedAge(born('2026-07-15', '2026-07-28'))).toBe(false) // 13 days
    expect(usesAdjustedAge(born('2026-07-15', '2026-07-29'))).toBe(true) // 14 days
  })
})
