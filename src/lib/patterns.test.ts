import { describe, expect, it } from 'vitest'
import { estimateByHour, estimateRecent, gapSamples, hoursApart, quantile } from './patterns'

const at = (iso: string) => new Date(iso)

describe('gapSamples', () => {
  it('measures the stretch between events', () => {
    const samples = gapSamples(
      ['2026-09-11T08:00:00', '2026-09-11T10:00:00', '2026-09-11T13:00:00'],
      45,
      8 * 60,
    )
    expect(samples.map((s) => s.value)).toEqual([120, 180])
  })

  it('folds a top-up into the feed it belongs to', () => {
    const samples = gapSamples(
      ['2026-09-11T08:00:00', '2026-09-11T08:20:00', '2026-09-11T10:00:00'],
      45,
      8 * 60,
    )
    expect(samples.map((s) => s.value)).toEqual([120])
  })

  it('drops a stretch long enough to be missing data', () => {
    const samples = gapSamples(['2026-09-11T08:00:00', '2026-09-12T08:00:00'], 45, 8 * 60)
    expect(samples).toEqual([])
  })

  it('does not mind the log being out of order', () => {
    const samples = gapSamples(['2026-09-11T10:00:00', '2026-09-11T08:00:00'], 45, 8 * 60)
    expect(samples.map((s) => s.value)).toEqual([120])
  })
})

describe('hoursApart', () => {
  it('takes the short way round the clock', () => {
    expect(hoursApart(23, 1)).toBe(2)
    expect(hoursApart(9, 11)).toBe(2)
  })
})

describe('quantile', () => {
  it('interpolates between neighbours', () => {
    expect(quantile([10, 20, 30, 40], 0.5)).toBe(25)
    expect(quantile([5], 0.5)).toBe(5)
  })
})

describe('estimateByHour', () => {
  const from = at('2026-09-11T14:00:00')

  it('prefers stretches from the same hour of the day', () => {
    const samples = [
      ...Array.from({ length: 6 }, (_, i) => ({ at: at(`2026-09-0${i + 1}T14:00:00`), value: 120 })),
      ...Array.from({ length: 20 }, (_, i) => ({ at: at(`2026-09-0${(i % 6) + 1}T03:00:00`), value: 300 })),
    ]
    const estimated = estimateByHour(samples, from, 14)!
    expect(estimated.value).toBe(120)
    expect(estimated.approximate).toBe(false)
  })

  it('widens the bucket rather than refusing to answer, and says it is rougher', () => {
    const samples = Array.from({ length: 6 }, (_, i) => ({
      at: at(`2026-09-0${i + 1}T16:00:00`),
      value: 90,
    }))
    const estimated = estimateByHour(samples, from, 14)!
    expect(estimated.value).toBe(90)
    expect(estimated.approximate).toBe(true)
  })

  it('has nothing to say about an empty history', () => {
    expect(estimateByHour([], from, 14)).toBeNull()
  })
})

describe('estimateRecent', () => {
  const from = at('2026-09-11T14:00:00')

  it('ignores the hour of day, which is the point of it', () => {
    const samples = [
      { at: at('2026-09-10T03:00:00'), value: 40 },
      { at: at('2026-09-10T14:00:00'), value: 60 },
      { at: at('2026-09-11T09:00:00'), value: 50 },
    ]
    expect(estimateRecent(samples, from, 14)!.value).toBe(50)
  })

  it('drops anything older than the window, so a growing baby is not held back', () => {
    const samples = [
      { at: at('2026-07-01T14:00:00'), value: 20 },
      { at: at('2026-07-02T14:00:00'), value: 20 },
      { at: at('2026-09-10T14:00:00'), value: 70 },
    ]
    expect(estimateRecent(samples, from, 14)!.value).toBe(70)
  })

  it('has nothing to say about an empty history', () => {
    expect(estimateRecent([], from, 14)).toBeNull()
  })
})
