/**
 * What babies around her age typically do, from published guidance — shown on
 * the Growth tab for interest only.
 *
 * Nothing here feeds a prediction. The app's forecasts learn from her own log
 * alone, so they keep up with her rather than with an average baby; this file
 * is imported by the Growth screen and nowhere else.
 *
 * Every range is wide on purpose: healthy babies sit well outside the middle
 * of all of these. Where a figure is popular advice rather than research, its
 * source says so.
 */

export type GuideId = 'sleep' | 'naps' | 'wake' | 'feeds' | 'bottle' | 'wet' | 'weight'

export interface AgeGuide {
  id: GuideId
  label: string
  /** The typical range in the guide's own unit, when it is a number */
  range?: [number, number]
  /** How the range reads, e.g. "14–17 h" */
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

/** Sleep in 24 hours, naps included, in minutes */
const SLEEP: Band<{ range: [number, number]; source: string }>[] = [
  { from: 0, to: 4, value: { range: [14 * HOUR, 17 * HOUR], source: 'US National Sleep Foundation, newborns' } },
  { from: 4, to: 12, value: { range: [12 * HOUR, 16 * HOUR], source: 'American Academy of Sleep Medicine, 4–12 months' } },
  { from: 12, to: 24, value: { range: [11 * HOUR, 14 * HOUR], source: 'American Academy of Sleep Medicine, 1–2 years' } },
]

/** Daytime naps a day; under three months there is no pattern to quote */
const NAPS: Band<{ range?: [number, number]; text?: string }>[] = [
  { from: 0, to: 3, value: { text: 'Lots of short naps, no set pattern yet' } },
  { from: 3, to: 5, value: { range: [3, 5] } },
  { from: 5, to: 8, value: { range: [2, 3] } },
  { from: 8, to: 15, value: { range: [2, 2] } },
  { from: 15, to: 24, value: { range: [1, 2] } },
]

/** Time awake between sleeps, in minutes */
const WAKE: Band<[number, number]>[] = [
  { from: 0, to: 1, value: [35, 60] },
  { from: 1, to: 3, value: [60, 90] },
  { from: 3, to: 5, value: [75, 120] },
  { from: 5, to: 7, value: [2 * HOUR, 3 * HOUR] },
  { from: 7, to: 11, value: [2.5 * HOUR, 3.5 * HOUR] },
  { from: 11, to: 14, value: [3 * HOUR, 4 * HOUR] },
  { from: 14, to: 24, value: [4 * HOUR, 6 * HOUR] },
]

/** Milk feeds in 24 hours */
const FEEDS: Band<{ range: [number, number]; text?: string; source: string }>[] = [
  { from: 0, to: 1, value: { range: [8, 12], source: 'American Academy of Pediatrics' } },
  { from: 1, to: 2, value: { range: [7, 9], source: 'American Academy of Pediatrics' } },
  {
    from: 2,
    to: 4,
    value: {
      range: [6, 9],
      text: '7–9 nursing, 6–8 by bottle',
      source: 'American Academy of Pediatrics; US CDC for bottles, every 3–4 hours',
    },
  },
  { from: 4, to: 6, value: { range: [5, 7], source: 'Commonly quoted' } },
  { from: 6, to: 12, value: { range: [4, 6], source: 'Commonly quoted, alongside solids' } },
]

/** Weight gain in grams a week */
const WEIGHT_GAIN: Band<[number, number]>[] = [
  { from: 0, to: 3, value: [150, 200] },
  { from: 3, to: 6, value: [100, 150] },
  { from: 6, to: 12, value: [70, 90] },
]

/** Formula until six months: 150–200 ml per kilo of body weight a day (NHS) */
const ML_PER_KG: [number, number] = [150, 200]
const ML_PER_KG_UNTIL_MONTHS = 6

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
 * is recorded, which turns the formula guide into millilitres.
 */
export function guidesForAge(ageMonths: number, weightKg?: number): AgeGuide[] {
  const guides: AgeGuide[] = []

  const sleep = pick(SLEEP, ageMonths)
  if (sleep) {
    guides.push({
      id: 'sleep',
      label: 'Sleep in 24 hours',
      range: sleep.range,
      text: `${hours(sleep.range[0])}–${hours(sleep.range[1])} h`,
      source: sleep.source,
    })
  }

  const naps = pick(NAPS, ageMonths)
  if (naps) {
    guides.push({
      id: 'naps',
      label: 'Daytime naps',
      range: naps.range,
      text: naps.range ? `${countText(naps.range)} a day` : naps.text!,
      source: 'Commonly quoted by sleep guides, not from research',
    })
  }

  const wake = pick(WAKE, ageMonths)
  if (wake) {
    guides.push({
      id: 'wake',
      label: 'Awake between sleeps',
      range: wake,
      text: minutesText(wake),
      source: 'Commonly quoted by sleep guides, not from research',
    })
  }

  const feeds = pick(FEEDS, ageMonths)
  if (feeds) {
    guides.push({
      id: 'feeds',
      label: 'Milk feeds in 24 hours',
      range: feeds.range,
      text: feeds.text ?? countText(feeds.range),
      source: feeds.source,
    })
  }

  if (ageMonths < ML_PER_KG_UNTIL_MONTHS) {
    const range: [number, number] | undefined = weightKg
      ? [Math.round((ML_PER_KG[0] * weightKg) / 10) * 10, Math.round((ML_PER_KG[1] * weightKg) / 10) * 10]
      : undefined
    guides.push({
      id: 'bottle',
      label: 'Formula in 24 hours',
      range,
      text: range
        ? `${range[0]}–${range[1]} ml at ${weightKg} kg`
        : `${ML_PER_KG[0]}–${ML_PER_KG[1]} ml per kg of her weight`,
      source: 'NHS, for a baby fed only formula',
    })
  }

  if (ageMonths < 12) {
    guides.push({
      id: 'wet',
      label: 'Wet nappies a day',
      range: [6, Infinity],
      text: '6 or more',
      source: 'NHS and Raising Children Network, after the first week',
    })
  }

  const gain = pick(WEIGHT_GAIN, ageMonths)
  if (gain) {
    guides.push({
      id: 'weight',
      label: 'Weight gain',
      range: gain,
      text: `${gain[0]}–${gain[1]} g a week`,
      source: 'Commonly quoted in child health guidance; her percentile curve says more',
    })
  }

  return guides
}
