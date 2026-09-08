import type { BabyProfile } from './types'

const MS_PER_DAY = 24 * 60 * 60 * 1000
/** Average days per month (365.25 / 12), used for fractional-month ages on charts */
export const DAYS_PER_MONTH = 30.4375

/** Parse YYYY-MM-DD as local midnight so age math matches the user's calendar */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Whole days from `from` to `to` (calendar days, local time) */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((atMidnight(to).getTime() - atMidnight(from).getTime()) / MS_PER_DAY)
}

export function ageInDays(birthDate: string, on: Date = new Date()): number {
  return daysBetween(parseISODate(birthDate), on)
}

/** Fractional age in months, for plotting against growth curves */
export function ageInMonthsFloat(birthDate: string, on: Date = new Date()): number {
  return ageInDays(birthDate, on) / DAYS_PER_MONTH
}

/** Completed calendar months between two dates (e.g. born Jan 15 → Mar 14 is 1 month) */
export function calendarMonthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) months -= 1
  return Math.max(0, months)
}

export function ageInCalendarMonths(birthDate: string, on: Date = new Date()): number {
  return calendarMonthsBetween(parseISODate(birthDate), atMidnight(on))
}

/**
 * Human-friendly age:
 *  - under 2 weeks: "11 days old"
 *  - under 12 weeks: "6 weeks, 3 days old"
 *  - under 24 months: "7 months, 2 weeks old"
 *  - after that: "2 years, 3 months old"
 */
export function formatAge(birthDate: string, on: Date = new Date()): string {
  const days = ageInDays(birthDate, on)
  if (days < 0) return 'not born yet'
  if (days === 0) return 'born today 🎉'
  if (days < 14) return `${days} ${plural(days, 'day')} old`
  if (days < 84) {
    const weeks = Math.floor(days / 7)
    const rem = days % 7
    return rem === 0
      ? `${weeks} weeks old`
      : `${weeks} ${plural(weeks, 'week')}, ${rem} ${plural(rem, 'day')} old`
  }
  const months = ageInCalendarMonths(birthDate, on)
  if (months < 24) {
    const birth = parseISODate(birthDate)
    const monthsAgo = new Date(birth.getFullYear(), birth.getMonth() + months, birth.getDate())
    const remWeeks = Math.floor(daysBetween(monthsAgo, on) / 7)
    return remWeeks === 0
      ? `${months} months old`
      : `${months} ${plural(months, 'month')}, ${remWeeks} ${plural(remWeeks, 'week')} old`
  }
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  return remMonths === 0
    ? `${years} ${plural(years, 'year')} old`
    : `${years} ${plural(years, 'year')}, ${remMonths} ${plural(remMonths, 'month')} old`
}

/**
 * Born this many days early or more and her development is read at her adjusted
 * age. Two weeks is the usual clinical cut-off for bothering to correct at all.
 */
export const ADJUSTED_AGE_FROM_DAYS_EARLY = 14

/**
 * Days of prematurity correction (0 if born on/after the due date, or no due date).
 * Only meaningful when born more than ~2 weeks early.
 */
export function correctionDays(profile: BabyProfile): number {
  if (!profile.dueDate) return 0
  const diff = daysBetween(parseISODate(profile.birthDate), parseISODate(profile.dueDate))
  return Math.max(0, diff)
}

/** Adjusted (corrected) age in days for a premature baby */
export function adjustedAgeInDays(profile: BabyProfile, on: Date = new Date()): number {
  return ageInDays(profile.birthDate, on) - correctionDays(profile)
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`
}

/** Whether her milestones and developmental band are read at her adjusted age */
export function usesAdjustedAge(profile: BabyProfile): boolean {
  return correctionDays(profile) >= ADJUSTED_AGE_FROM_DAYS_EARLY
}

/**
 * The age her development is read at: adjusted if she arrived early enough,
 * otherwise her actual age. One place decides this, so the rule cannot drift
 * between the screens that show milestones.
 */
export function developmentalAgeMonths(profile: BabyProfile, on: Date = new Date()): number {
  return usesAdjustedAge(profile)
    ? adjustedAgeInDays(profile, on) / DAYS_PER_MONTH
    : ageInMonthsFloat(profile.birthDate, on)
}
