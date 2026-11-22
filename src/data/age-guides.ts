/**
 * What babies around her age typically do, from Australian guidance — shown on
 * the Growth tab for interest only.
 *
 * Nothing here feeds a prediction. The app's forecasts learn from her own log
 * alone, so they keep up with her rather than with an average baby; this file
 * is imported by the Growth screen and nowhere else.
 *
 * Every range is wide on purpose: healthy babies sit well outside the middle
 * of all of these. Where a figure is popular advice rather than published
 * guidance, its source says so.
 */

export type GuideId = 'sleep' | 'naps' | 'wake' | 'feeds' | 'bottle' | 'wet' | 'weight'

export interface AgeGuide {
  id: GuideId
  label: string
  /** The typical range as it reads, e.g. "14–17 h" */
  text: string
  source: string
}

interface Band<T> {
  /** Applies from this age in months (inclusive) up to `to` (exclusive) */
  from: number
  to: number
  value: T
}

function pick<T>(bands: Band<T>[], ageMonths: number): T | undefined {
  return bands.find((b) => ageMonths >= b.from && ageMonths < b.to)?.value
}

const HOUR = 60

const MOVEMENT_GUIDELINES = 'Australian 24-Hour Movement Guidelines'
const COMMONLY_QUOTED = 'Commonly quoted by sleep guides, not from published guidance'

/** Sleep in 24 hours, naps included, in minutes */
const SLEEP: Band<{ range: [number, number]; source: string }>[] = [
  { from: 0, to: 4, value: { range: [14 * HOUR, 17 * HOUR], source: `${MOVEMENT_GUIDELINES}, 0–3 months` } },
  { from: 4, to: 12, value: { range: [12 * HOUR, 16 * HOUR], source: `${MOVEMENT_GUIDELINES}, 4–11 months` } },
  { from: 12, to: 24, value: { range: [11 * HOUR, 14 * HOUR], source: `${MOVEMENT_GUIDELINES}, 1–2 years` } },
]

/** Daytime naps a day; under three months there is no pattern to quote */
const NAPS: Band<{ range?: [number, number]; text?: string; source: string }>[] = [
  { from: 0, to: 3, value: { text: 'Lots of short naps, no set pattern yet', source: COMMONLY_QUOTED } },
  {
    from: 3,
    to: 12,
    value: { range: [2, 3], source: 'Raising Children Network: 2–3 naps of 30 minutes to 2 hours, at 2–12 months' },
  },
  { from: 12, to: 15, value: { range: [2, 2], source: COMMONLY_QUOTED } },
  { from: 15, to: 24, value: { range: [1, 2], source: COMMONLY_QUOTED } },
]

/** Time awake between sleeps, in minutes */
const WAKE: Band<{ range: [number, number]; text?: string; source: string }>[] = [
  { from: 0, to: 1, value: { range: [35, 60], source: COMMONLY_QUOTED } },
  { from: 1, to: 3, value: { range: [60, 90], source: COMMONLY_QUOTED } },
  { from: 3, to: 5, value: { range: [2 * HOUR, 2 * HOUR], text: 'About 2 h', source: 'Tresillian, 3–4 months' } },
  { from: 5, to: 7, value: { range: [2 * HOUR, 3 * HOUR], source: 'Tresillian, 5–6 months' } },
  { from: 7, to: 11, value: { range: [2.5 * HOUR, 3.5 * HOUR], source: COMMONLY_QUOTED } },
  { from: 11, to: 14, value: { range: [3 * HOUR, 4 * HOUR], source: COMMONLY_QUOTED } },
  { from: 14, to: 24, value: { range: [4 * HOUR, 6 * HOUR], source: COMMONLY_QUOTED } },
]

/** Milk feeds in 24 hours */
const FEEDS: Band<{ range: [number, number]; text?: string; source: string }>[] = [
  {
    from: 0,
    to: 3,
    value: {
      range: [6, 12],
      text: '8–12 nursing, 6–8 by bottle',
      source: 'Raising Children Network (nursing); Pregnancy, Birth and Baby (bottles)',
    },
  },
  {
    from: 3,
    to: 6,
    value: { range: [5, 6], text: '5–6 by bottle', source: 'Pregnancy, Birth and Baby, from around 3 months' },
  },
  { from: 6, to: 12, value: { range: [4, 6], source: 'Commonly quoted, alongside solids' } },
]

/** Weight gain in grams a week: a guide, not a minimum */
const WEIGHT_GAIN: Band<[number, number]>[] = [
  { from: 0, to: 3, value: [150, 200] },
  { from: 3, to: 6, value: [100, 150] },
  { from: 6, to: 12, value: [70, 90] },
]

/**
 * Formula for a baby fed only formula, per kilo of body weight a day, from the
 * NHMRC Infant Feeding Guidelines: about 150 ml to 3 months, then about 120.
 */
const ML_PER_KG: Band<number>[] = [
  { from: 0, to: 3, value: 150 },
  { from: 3, to: 6, value: 120 },
]

function hours(minutes: number): string {
  const h = minutes / HOUR
  return Number.isInteger(h) ? `${h}` : h.toFixed(1)
}

function minutesText([lo, hi]: [number, number]): string {
  return hi < 2 * HOUR ? `${lo}–${hi} min` : `${hours(lo)}–${hours(hi)} h`
}

function countText([lo, hi]: [number, number]): string {
  return lo === hi ? `${lo}` : `${lo}–${hi}`
}

/**
 * The guides that apply at this age. `weightKg` is her latest weight, if one
 * is recorded, which turns the formula guide into millilitres — or an
 * estimate of it today, when `estimated` says so.
 */
export function guidesForAge(ageMonths: number, weightKg?: number, estimated = false): AgeGuide[] {
  const guides: AgeGuide[] = []

  const sleep = pick(SLEEP, ageMonths)
  if (sleep) {
    guides.push({
      id: 'sleep',
      label: 'Sleep in 24 hours',
      text: `${hours(sleep.range[0])}–${hours(sleep.range[1])} h`,
      source: sleep.source,
    })
  }

  const naps = pick(NAPS, ageMonths)
  if (naps) {
    guides.push({
      id: 'naps',
      label: 'Daytime naps',
      text: naps.range ? `${countText(naps.range)} a day` : naps.text!,
      source: naps.source,
    })
  }

  const wake = pick(WAKE, ageMonths)
  if (wake) {
    guides.push({
      id: 'wake',
      label: 'Awake between sleeps',
      text: wake.text ?? minutesText(wake.range),
      source: wake.source,
    })
  }

  const feeds = pick(FEEDS, ageMonths)
  if (feeds) {
    guides.push({
      id: 'feeds',
      label: 'Milk feeds in 24 hours',
      text: feeds.text ?? countText(feeds.range),
      source: feeds.source,
    })
  }

  const perKg = pick(ML_PER_KG, ageMonths)
  if (perKg) {
    guides.push({
      id: 'bottle',
      label: 'Formula in 24 hours',
      text: weightKg
        ? `About ${Math.round((perKg * weightKg) / 10) * 10} ml at ${weightKg} kg${estimated ? ' (estimated weight)' : ''}`
        : `About ${perKg} ml per kg of {his} weight`,
      source: 'NHMRC Infant Feeding Guidelines, for a baby fed only formula; some need more, some less',
    })
  }

  if (ageMonths < 12) {
    guides.push({
      id: 'wet',
      label: 'Wet nappies a day',
      text: '5 or more heavy disposables, or 6–8 cloth',
      source: 'Raising Children Network',
    })
  }

  const gain = pick(WEIGHT_GAIN, ageMonths)
  if (gain) {
    guides.push({
      id: 'weight',
      label: 'Weight gain',
      text: `${gain[0]}–${gain[1]} g a week`,
      source: 'Tresillian and RCH Melbourne, a guide rather than a minimum; {his} percentile curve says more',
    })
  }

  return guides
}
