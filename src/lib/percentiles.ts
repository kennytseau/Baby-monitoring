/** One row of a growth reference curve at a given age */
export interface CurveRow {
  month: number
  p3: number
  p15: number
  p50: number
  p85: number
  p97: number
}

/** z-scores corresponding to the stored percentiles */
const CURVE_POINTS: Array<{ key: keyof Omit<CurveRow, 'month'>; z: number }> = [
  { key: 'p3', z: -1.881 },
  { key: 'p15', z: -1.036 },
  { key: 'p50', z: 0 },
  { key: 'p85', z: 1.036 },
  { key: 'p97', z: 1.881 },
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Interpolate the curve values at a fractional age in months (clamped to the table range) */
export function curveAt(rows: CurveRow[], ageMonths: number): CurveRow {
  const first = rows[0]
  const last = rows[rows.length - 1]
  if (ageMonths <= first.month) return first
  if (ageMonths >= last.month) return last
  let hi = 1
  while (rows[hi].month < ageMonths) hi++
  const lo = hi - 1
  const t = (ageMonths - rows[lo].month) / (rows[hi].month - rows[lo].month)
  return {
    month: ageMonths,
    p3: lerp(rows[lo].p3, rows[hi].p3, t),
    p15: lerp(rows[lo].p15, rows[hi].p15, t),
    p50: lerp(rows[lo].p50, rows[hi].p50, t),
    p85: lerp(rows[lo].p85, rows[hi].p85, t),
    p97: lerp(rows[lo].p97, rows[hi].p97, t),
  }
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 approximation) */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

/**
 * Estimate the percentile (1–99) of a measurement at a given age by
 * interpolating between the stored percentile curves in z-space.
 * Beyond the outermost curves the last segment's slope is extrapolated,
 * clamped to z = ±2.7 (≈ 0.3rd–99.7th percentile).
 */
export function estimatePercentile(rows: CurveRow[], ageMonths: number, value: number): number {
  const row = curveAt(rows, ageMonths)
  const pts = CURVE_POINTS.map((p) => ({ v: row[p.key], z: p.z }))

  let z: number
  if (value <= pts[0].v) {
    const slope = (pts[1].z - pts[0].z) / (pts[1].v - pts[0].v)
    z = pts[0].z + (value - pts[0].v) * slope
  } else if (value >= pts[pts.length - 1].v) {
    const a = pts[pts.length - 2]
    const b = pts[pts.length - 1]
    const slope = (b.z - a.z) / (b.v - a.v)
    z = b.z + (value - b.v) * slope
  } else {
    z = 0
    for (let i = 1; i < pts.length; i++) {
      if (value <= pts[i].v) {
        const t = (value - pts[i - 1].v) / (pts[i].v - pts[i - 1].v)
        z = lerp(pts[i - 1].z, pts[i].z, t)
        break
      }
    }
  }

  z = Math.max(-2.7, Math.min(2.7, z))
  const pct = normalCdf(z) * 100
  return Math.max(1, Math.min(99, Math.round(pct)))
}

/** "3rd", "50th", "97th"... */
export function ordinal(n: number): string {
  const rem10 = n % 10
  const rem100 = n % 100
  if (rem10 === 1 && rem100 !== 11) return `${n}st`
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`
  return `${n}th`
}
