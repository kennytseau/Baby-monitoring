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

export type GuideId = 'sleep' | 'naps' | 'daySleep' | 'wake' | 'feeds' | 'bottle' | 'wet' | 'weight'

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

/*
 * Bands are as narrow as Australian guidance gets, month by month where it
 * goes that fine: Karitane and Tresillian (the NSW parenting services) give
 * figures by age where the national guidelines give one range for most of the
 * first year. Where the two differ, the band names the one it uses. The card
 * moves to the next band on its own as she grows.
 */
const MOVEMENT_GUIDELINES = 'Australian 24-Hour Movement Guidelines'
/** NSW Health's children's hospitals network and a local health district */
const SCHN = "Sydney Children's Hospitals Network (NSW Health)"
const SESLHD = 'South Eastern Sydney Local Health District (NSW Health)'
const COMMONLY_QUOTED = 'Commonly quoted by sleep guides, not from published guidance'

interface Guide {
  range: [number, number]
  /** How it reads, when the range alone would not say it well */
  text?: string
  source: string
}

/** Sleep in 24 hours, naps included, in minutes */
const SLEEP: Band<Guide>[] = [
  { from: 0, to: 3, value: { range: [14 * HOUR, 17 * HOUR], source: `${MOVEMENT_GUIDELINES}, 0–3 months` } },
  { from: 3, to: 7, value: { range: [14 * HOUR, 15 * HOUR], source: 'Karitane, 3–6 months' } },
  { from: 7, to: 12, value: { range: [12 * HOUR, 14 * HOUR], source: 'Karitane, 7–12 months' } },
  { from: 12, to: 24, value: { range: [11 * HOUR, 14 * HOUR], source: `${MOVEMENT_GUIDELINES}, 1–2 years` } },
]

/** Daytime naps a day */
const NAPS: Band<Guide>[] = [
  { from: 0, to: 1.5, value: { range: [0, 0], text: 'Lots of short sleeps, no set pattern yet', source: COMMONLY_QUOTED } },
  { from: 1.5, to: 3, value: { range: [3, 4], source: 'Tresillian, 6–12 weeks' } },
  {
    from: 3,
    to: 6,
    value: { range: [2, 3], source: `Tresillian, 3–5 months (2–3); ${SCHN}: around 3` },
  },
  {
    from: 6,
    to: 9,
    value: { range: [2, 3], source: `${SCHN}: many drop from three naps to two at 6–9 months; Tresillian: 2` },
  },
  { from: 9, to: 12, value: { range: [2, 2], source: 'Tresillian and Karitane, 9–12 months' } },
  { from: 12, to: 18, value: { range: [1, 2], source: 'Tresillian: two naps become one between 12 and 18 months' } },
  { from: 18, to: 24, value: { range: [1, 1], source: 'Raising Children Network, toddlers' } },
]

/** Day sleep in total, in minutes */
const DAY_SLEEP: Band<Guide>[] = [
  { from: 3, to: 6, value: { range: [3 * HOUR, 4 * HOUR], source: 'Tresillian, 3–5 months' } },
  { from: 6, to: 9, value: { range: [2 * HOUR, 3 * HOUR], source: 'Tresillian, 6–8 months' } },
  { from: 9, to: 12, value: { range: [2 * HOUR, 3 * HOUR], source: 'Tresillian, 9–12 months' } },
  { from: 12, to: 18, value: { range: [1 * HOUR, 3 * HOUR], source: 'Tresillian, 12–18 months' } },
  { from: 18, to: 24, value: { range: [1 * HOUR, 2 * HOUR], source: 'Raising Children Network, toddlers' } },
]

/** Time awake between sleeps, in minutes */
const WAKE: Band<Guide>[] = [
  { from: 0, to: 1.5, value: { range: [1 * HOUR, 2 * HOUR], source: 'Tresillian, newborn to 6 weeks, feeds included' } },
  { from: 1.5, to: 3, value: { range: [1 * HOUR, 2.5 * HOUR], source: 'Tresillian, 6–12 weeks' } },
  { from: 3, to: 4.5, value: { range: [1.5 * HOUR, 2 * HOUR], source: 'Karitane, 3–4½ months' } },
  { from: 4.5, to: 6, value: { range: [2 * HOUR, 2.5 * HOUR], source: 'Karitane, 4½–6 months' } },
  { from: 6, to: 9, value: { range: [2 * HOUR, 3 * HOUR], source: 'Karitane, 6–9 months' } },
  { from: 9, to: 11, value: { range: [2.5 * HOUR, 3.5 * HOUR], source: 'Tresillian, 9–10 months' } },
  { from: 11, to: 12, value: { range: [3 * HOUR, 4 * HOUR], source: 'Tresillian, around 12 months' } },
  { from: 12, to: 14, value: { range: [3 * HOUR, 4 * HOUR], source: COMMONLY_QUOTED } },
  { from: 14, to: 24, value: { range: [4 * HOUR, 6 * HOUR], source: COMMONLY_QUOTED } },
]

/** Milk feeds in 24 hours */
const FEEDS: Band<Guide>[] = [
  {
    from: 0,
    to: 3,
    value: {
      range: [6, 12],
      text: '8–12 nursing, 6–8 by bottle',
      source: `Raising Children Network (nursing); Pregnancy, Birth and Baby (bottles); ${SESLHD}: up to 8 at one month`,
    },
  },
  {
    from: 3,
    to: 4,
    value: { range: [5, 6], text: '5–6 by bottle', source: 'Pregnancy, Birth and Baby, from around 3 months' },
  },
  {
    from: 4,
    to: 6,
    value: { range: [6, 7], text: 'About 5 by day and 1–2 overnight', source: 'Tresillian, 4–5 months' },
  },
  {
    from: 6,
    to: 12,
    value: { range: [4, 6], text: '4–6, alongside solids', source: `Karitane, 6–12 months; ${SESLHD}: around 5 at six months` },
  },
]

/** Weight gain in grams a week: a guide, not a minimum */
const WEIGHT_GAIN: Band<[number, number]>[] = [
  { from: 0, to: 3, value: [150, 200] },
  { from: 3, to: 6, value: [100, 150] },
  { from: 6, to: 12, value: [70, 90] },
]

/**
 * Formula for a baby fed only formula, per kilo of body weight a day, from the
 * NHMRC Infant Feeding Guidelines: about 150 ml to 3 months, about 120 to 6,
 * then about 100 alongside solids, down to 90 for some (as SESLHD gives it).
 */
const ML_PER_KG: Band<{ range: [number, number]; source: string }>[] = [
  { from: 0, to: 3, value: { range: [150, 150], source: 'NHMRC Infant Feeding Guidelines, 0–3 months' } },
  { from: 3, to: 6, value: { range: [120, 120], source: 'NHMRC Infant Feeding Guidelines, 3–6 months' } },
  {
    from: 6,
    to: 12,
    value: { range: [90, 100], source: `NHMRC Infant Feeding Guidelines via ${SESLHD}, 6–12 months` },
  },
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
      text: naps.text ?? `${countText(naps.range)} a day`,
      source: naps.source,
    })
  }

  const daySleep = pick(DAY_SLEEP, ageMonths)
  if (daySleep) {
    guides.push({
      id: 'daySleep',
      label: 'Day sleep in total',
      text: `${hours(daySleep.range[0])}–${hours(daySleep.range[1])} h`,
      source: daySleep.source,
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
    const [lo, hi] = perKg.range
    const ml = (perKgMl: number) => Math.round((perKgMl * weightKg!) / 10) * 10
    guides.push({
      id: 'bottle',
      label: 'Formula in 24 hours',
      text: weightKg
        ? `${lo === hi ? `About ${ml(lo)}` : `${ml(lo)}–${ml(hi)}`} ml at ${weightKg} kg${estimated ? ' (estimated weight)' : ''}`
        : `${lo === hi ? `About ${lo}` : `${lo}–${hi}`} ml per kg of {his} weight`,
      source: `${perKg.source}, for a baby fed only formula; some need more, some less`,
    })
  }

  if (ageMonths < 12) {
    guides.push({
      id: 'wet',
      label: 'Wet nappies a day',
      text: '5 or more heavy disposables, or 6–8 cloth',
      source: `Raising Children Network; ${SESLHD}`,
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
