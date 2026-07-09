import { useMemo, useState } from 'react'
import type { PointerEvent } from 'react'
import type { CurveRow } from '../lib/percentiles'
import { curveAt, estimatePercentile, ordinal } from '../lib/percentiles'
import { formatDate } from '../lib/format'

export interface ChartPoint {
  date: string
  ageMonths: number
  value: number
}

const W = 380
const H = 260
const PAD = { top: 14, right: 40, bottom: 34, left: 38 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

const PCT_LABELS: Array<{ key: keyof Omit<CurveRow, 'month'>; label: string }> = [
  { key: 'p97', label: '97th' },
  { key: 'p85', label: '85th' },
  { key: 'p50', label: '50th' },
  { key: 'p15', label: '15th' },
  { key: 'p3', label: '3rd' },
]

/**
 * Baby's measurements plotted over shaded reference percentile bands
 * (P3–P97 outer, P15–P85 inner, dashed median).
 */
export function GrowthChart({
  rows,
  points,
  unit,
  currentAgeMonths,
}: {
  rows: CurveRow[]
  points: ChartPoint[]
  unit: string
  currentAgeMonths: number
}) {
  const [hover, setHover] = useState<number | null>(null)

  const { xMax, yMin, yMax, xTicks, yTicks } = useMemo(() => {
    const maxDataAge = points.length ? Math.max(...points.map((p) => p.ageMonths)) : 0
    const xMax = Math.min(24, Math.max(6, Math.ceil(Math.max(maxDataAge, currentAgeMonths) + 2)))
    const windowRows = rows.filter((r) => r.month <= xMax)
    let yMin = Math.min(...windowRows.map((r) => r.p3))
    let yMax = Math.max(...windowRows.map((r) => r.p97))
    for (const p of points) {
      if (p.ageMonths <= xMax) {
        yMin = Math.min(yMin, p.value)
        yMax = Math.max(yMax, p.value)
      }
    }
    const padY = (yMax - yMin) * 0.06
    yMin -= padY
    yMax += padY
    const xStep = xMax <= 8 ? 1 : xMax <= 14 ? 2 : 3
    const xTicks: number[] = []
    for (let m = 0; m <= xMax; m += xStep) xTicks.push(m)
    const yTicks = niceTicks(yMin, yMax, 5)
    return { xMax, yMin, yMax, xTicks, yTicks }
  }, [rows, points, currentAgeMonths])

  const sx = (m: number) => PAD.left + (m / xMax) * PLOT_W
  const sy = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * PLOT_H

  const curveXs = useMemo(() => {
    const xs: number[] = []
    for (let m = 0; m <= xMax; m += 0.5) xs.push(m)
    return xs
  }, [xMax])

  const bandPath = (upper: keyof Omit<CurveRow, 'month'>, lower: keyof Omit<CurveRow, 'month'>) => {
    const up = curveXs.map((m) => `${sx(m).toFixed(1)},${sy(curveAt(rows, m)[upper]).toFixed(1)}`)
    const down = [...curveXs]
      .reverse()
      .map((m) => `${sx(m).toFixed(1)},${sy(curveAt(rows, m)[lower]).toFixed(1)}`)
    return `M${up.join('L')}L${down.join('L')}Z`
  }
  const linePath = (key: keyof Omit<CurveRow, 'month'>) =>
    `M${curveXs.map((m) => `${sx(m).toFixed(1)},${sy(curveAt(rows, m)[key]).toFixed(1)}`).join('L')}`

  const visible = points.filter((p) => p.ageMonths <= xMax)
  const dataPath = visible.length > 1 ? `M${visible.map((p) => `${sx(p.ageMonths).toFixed(1)},${sy(p.value).toFixed(1)}`).join('L')}` : null
  const lastRow = curveAt(rows, xMax)

  function onMove(e: PointerEvent<SVGSVGElement>) {
    if (!visible.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    let bestDist = Infinity
    visible.forEach((p, i) => {
      const d = Math.abs(sx(p.ageMonths) - px)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    setHover(bestDist < 40 ? best : null)
  }

  const hoverPoint = hover != null ? visible[hover] : null

  return (
    <div className="gc-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Growth chart: measurements in ${unit} by age in months over reference percentile bands`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* reference bands */}
        <path d={bandPath('p97', 'p3')} className="gc-band-outer" />
        <path d={bandPath('p85', 'p15')} className="gc-band-inner" />
        <path d={linePath('p50')} className="gc-median" />

        {/* grid + axes */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={sy(t)} y2={sy(t)} className="gc-grid" />
            <text x={PAD.left - 6} y={sy(t) + 3.5} className="gc-tick" textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={sx(t)} y={H - PAD.bottom + 16} className="gc-tick" textAnchor="middle">
            {t}
          </text>
        ))}
        <text x={PAD.left + PLOT_W / 2} y={H - 4} className="gc-tick" textAnchor="middle">
          age (months)
        </text>

        {/* percentile labels at right edge */}
        {PCT_LABELS.map(({ key, label }) => (
          <text
            key={key}
            x={W - PAD.right + 4}
            y={sy(lastRow[key]) + 3}
            className="gc-pct-label"
          >
            {label}
          </text>
        ))}

        {/* baby's data */}
        {dataPath && <path d={dataPath} className="gc-data-line" />}
        {visible.map((p, i) => (
          <circle
            key={p.date + i}
            cx={sx(p.ageMonths)}
            cy={sy(p.value)}
            r={hover === i ? 6 : 4.5}
            className="gc-dot"
          />
        ))}
        {visible.length > 0 && !hoverPoint && (
          <text
            x={Math.min(sx(visible[visible.length - 1].ageMonths) + 8, W - PAD.right - 2)}
            y={sy(visible[visible.length - 1].value) - 8}
            className="gc-data-label"
          >
            {visible[visible.length - 1].value} {unit}
          </text>
        )}
      </svg>

      {hoverPoint && (
        <div
          className="gc-tooltip"
          style={{
            left: `${(sx(hoverPoint.ageMonths) / W) * 100}%`,
            top: `${(sy(hoverPoint.value) / H) * 100}%`,
          }}
        >
          <strong>
            {hoverPoint.value} {unit}
          </strong>
          <span>
            {formatDate(hoverPoint.date)} · ~{ordinal(estimatePercentile(rows, hoverPoint.ageMonths, hoverPoint.value))}{' '}
            percentile
          </span>
        </div>
      )}

      {visible.length === 0 && (
        <div className="gc-empty">No measurements yet — add her first one below.</div>
      )}
    </div>
  )
}

function niceTicks(min: number, max: number, target: number): number[] {
  const range = max - min
  const rough = range / target
  const pow = Math.pow(10, Math.floor(Math.log10(rough)))
  const candidates = [1, 2, 2.5, 5, 10].map((c) => c * pow)
  const step = candidates.find((c) => range / c <= target) ?? candidates[candidates.length - 1]
  const ticks: number[] = []
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) {
    ticks.push(Math.round(t * 100) / 100)
  }
  return ticks
}
