import { describe, expect, it } from 'vitest'
import { curveAt, estimatePercentile, normalCdf, ordinal } from './percentiles'
import { GROWTH_CURVES } from '../data/who-growth'

const girlsWeight = GROWTH_CURVES.female.weight

describe('curveAt', () => {
  it('returns exact rows at table ages', () => {
    expect(curveAt(girlsWeight, 2).p50).toBe(5.1)
  })
  it('interpolates between months', () => {
    const row = curveAt(girlsWeight, 2.5)
    expect(row.p50).toBeGreaterThan(5.1)
    expect(row.p50).toBeLessThan(5.8)
    expect(row.p50).toBeCloseTo((5.1 + 5.8) / 2, 5)
  })
  it('clamps below and above the table range', () => {
    expect(curveAt(girlsWeight, -1).p50).toBe(girlsWeight[0].p50)
    expect(curveAt(girlsWeight, 99).p50).toBe(girlsWeight[girlsWeight.length - 1].p50)
  })
})

describe('normalCdf', () => {
  it('is 0.5 at zero and symmetric', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
    expect(normalCdf(1.881)).toBeCloseTo(0.97, 2)
    expect(normalCdf(-1.881)).toBeCloseTo(0.03, 2)
  })
})

describe('estimatePercentile', () => {
  it('maps stored percentile values back to their percentiles', () => {
    const row = curveAt(girlsWeight, 6)
    expect(estimatePercentile(girlsWeight, 6, row.p50)).toBe(50)
    expect(estimatePercentile(girlsWeight, 6, row.p85)).toBe(85)
    expect(estimatePercentile(girlsWeight, 6, row.p3)).toBe(3)
  })
  it('interpolates between curves', () => {
    const row = curveAt(girlsWeight, 6)
    const mid = (row.p50 + row.p85) / 2
    const pct = estimatePercentile(girlsWeight, 6, mid)
    expect(pct).toBeGreaterThan(50)
    expect(pct).toBeLessThan(85)
  })
  it('clamps extreme values into 1–99', () => {
    expect(estimatePercentile(girlsWeight, 6, 1)).toBe(1)
    expect(estimatePercentile(girlsWeight, 6, 20)).toBe(99)
  })
})

describe('growth tables', () => {
  it('every curve is monotonically increasing across percentiles and ages', () => {
    for (const sex of ['female', 'male'] as const) {
      for (const measure of ['weight', 'length', 'head'] as const) {
        const rows = GROWTH_CURVES[sex][measure]
        expect(rows[0].month).toBe(0)
        expect(rows[rows.length - 1].month).toBe(24)
        for (const row of rows) {
          expect(row.p3).toBeLessThan(row.p15)
          expect(row.p15).toBeLessThan(row.p50)
          expect(row.p50).toBeLessThan(row.p85)
          expect(row.p85).toBeLessThan(row.p97)
        }
        for (let i = 1; i < rows.length; i++) {
          expect(rows[i].month).toBe(rows[i - 1].month + 1)
          expect(rows[i].p50).toBeGreaterThan(rows[i - 1].p50)
        }
      }
    }
  })
})

describe('ordinal', () => {
  it('formats English ordinals', () => {
    expect(ordinal(1)).toBe('1st')
    expect(ordinal(2)).toBe('2nd')
    expect(ordinal(3)).toBe('3rd')
    expect(ordinal(11)).toBe('11th')
    expect(ordinal(50)).toBe('50th')
    expect(ordinal(93)).toBe('93rd')
  })
})
