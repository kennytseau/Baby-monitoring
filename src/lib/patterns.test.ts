import { describe, expect, it } from 'vitest'
import { estimate, gapSamples, hoursApart, quantile } from './patterns'

const at = (iso: string) => new Date(iso)

describe('gapSamples', () => {
  it('measures the stretch between events', () => {
    const samples = gapSamples(
      ['2026-09-11T08:00:00', '2026-09-11T10:00:00', '2026-09-11T13:00:00'],
      45,
      8 * 60,
    )
    expect(samples.map((s) => s.minutes)).toEqual([120, 180])
  })

  it('folds a top-up into the feed it belongs to', () => {
    const samples = gapSamples(
      ['2026-09-11T08:00:00', '2026-09-11T08:20:00', '2026-09-11T10:00:00'],
      45,
      8 * 60,
    )
    expect(samples.map((s) => s.minutes)).toEqual([120])
  })

  it('drops a stretch long enough to be missing data', () => {
    const samples = gapSamples(['2026-09-11T08:00:00', '2026-09-12T08:00:00'], 45, 8 * 60)
    expect(samples).toEqual([])
  })

  it('does not mind the log being out of order', () => {
    const samples = gapSamples(['2026-09-11T10:00:00', '2026-09-11T08:00:00'], 45, 8 * 60)
    expect(samples.map((s) => s.minutes)).toEqual([120])
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

describe('estimate', () => {
  const from = at('2026-09-11T14:00:00')

  it('prefers stretches from the same hour of the day', () => {
    const samples = [
      ...Array.from({ length: 6 }, (_, i) => ({ at: at(`2026-09-0${i + 1}T14:00:00`), minutes: 120 })),
      ...Array.from({ length: 20 }, (_, i) => ({ at: at(`2026-09-0${(i % 6) + 1}T03:00:00`), minutes: 300 })),
    ]
    const estimated = estimate(samples, from, 14)!
    expect(estimated.minutes).toBe(120)
    expect(estimated.approximate).toBe(false)
  })

  it('widens the bucket rather than refusing to answer, and says it is rougher', () => {
    const samples = Array.from({ length: 6 }, (_, i) => ({
      at: at(`2026-09-0${i + 1}T16:00:00`),
      minutes: 90,
    }))
    const estimated = estimate(samples, from, 14)!
    expect(estimated.minutes).toBe(90)
    expect(estimated.approximate).toBe(true)
  })

  it('has nothing to say about an empty history', () => {
    expect(estimate([], from, 14)).toBeNull()
  })
})
