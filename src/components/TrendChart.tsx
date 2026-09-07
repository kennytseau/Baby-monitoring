import { useState } from 'react'
import type { TrendSeries } from '../lib/trends'
import { comparedToUsual } from '../lib/trends'
import { formatDayLabel } from '../lib/format'

/**
 * One measure, one bar per day, oldest on the left.
 *
 * A single series, so there is no legend — the title says what is plotted. Today
 * is the bar the story is about, so it is the one that carries a direct label
 * and the stronger step of the same hue; the rest stay recessive. The dashed
 * rule is her usual level, which is the whole point: you are looking to see
 * whether today sits above or below it.
 */
const WIDTH = 320
const HEIGHT = 96
const BASELINE = HEIGHT - 18
const TOP = 16
/** Bars are capped rather than filling the slot, so the band keeps some air */
const MAX_BAR = 24
/** The surface gap that separates touching bars */
const GAP = 2

export function TrendChart({
  series,
  title,
  format,
}: {
  series: TrendSeries
  title: string
  format: (value: number) => string
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const points = series.points
  if (points.length === 0) return null

  const peak = Math.max(series.max, 1)
  const slot = WIDTH / points.length
  const barWidth = Math.min(MAX_BAR, slot - GAP * 2)
  const y = (value: number) => BASELINE - (value / peak) * (BASELINE - TOP)

  const shown =
    selected != null ? points[selected] : (points.find((p) => p.isToday) ?? points[points.length - 1])
  const change = comparedToUsual(series)

  return (
    <section className="card trend-card">
      <div className="row-between">
        <h3 className="trend-title">{title}</h3>
        <span className="tiny faint">
          usual {format(series.usual)} · low {format(series.min)} · high {format(series.max)}
        </span>
      </div>

      <div className="row-between trend-headline">
        <span className="trend-value">{format(shown.value)}</span>
        <span className="tiny muted">
          {shown.isToday && selected == null ? 'today' : formatDayLabel(shown.day)}
          {shown.isToday && change != null
            ? ` · ${
                change === 0
                  ? 'same as usual by now'
                  : `${change > 0 ? '▲' : '▼'} ${Math.abs(change)}% vs usual by now`
              }`
            : ''}
        </span>
      </div>

      <svg
        className="trend-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${title} by day. Today ${format(shown.value)}, usually ${format(series.usual)}.`}
      >
        {/* Hairline baseline, solid and one step off the surface */}
        <line className="tc-axis" x1="0" y1={BASELINE} x2={WIDTH} y2={BASELINE} />

        {series.usual > 0 && (
          <>
            {/* Her usual level — a threshold, which is what dashing is for */}
            <line className="tc-usual" x1="0" y1={y(series.usual)} x2={WIDTH} y2={y(series.usual)} />
            {/* Anchored left, because the labelled bar is usually the last one */}
            <text className="tc-usual-label" x="0" y={y(series.usual) - 4}>
              usual
            </text>
          </>
        )}

        {points.map((point, i) => {
          const height = Math.max(point.value > 0 ? 2 : 0, BASELINE - y(point.value))
          const x = i * slot + (slot - barWidth) / 2
          return (
            <g key={point.day} onClick={() => setSelected(selected === i ? null : i)}>
              {/* A hit target taller than the bar, so a thumb finds it */}
              <rect x={i * slot} y="0" width={slot} height={HEIGHT} fill="transparent" />
              <rect
                className={point.isToday ? 'tc-bar tc-bar-today' : 'tc-bar'}
                x={x}
                y={BASELINE - height}
                width={barWidth}
                height={height}
                rx="4"
                opacity={selected != null && selected !== i ? 0.55 : 1}
              />
              <text className="tc-day" x={i * slot + slot / 2} y={HEIGHT - 4} textAnchor="middle">
                {new Date(point.day).toLocaleDateString(undefined, { weekday: 'narrow' })}
              </text>
            </g>
          )
        })}

        {/* Label only the bar the story is about, never every bar */}
        {points.map((point, i) =>
          (selected == null ? point.isToday : selected === i) && point.value > 0 ? (
            <text
              key={`label-${point.day}`}
              className="tc-value"
              // Nudged in at the edges so the text can never be clipped by the plot
              x={Math.min(Math.max(i * slot + slot / 2, 26), WIDTH - 26)}
              y={Math.max(y(point.value) - 5, 10)}
              textAnchor="middle"
            >
              {format(point.value)}
            </text>
          ) : null,
        )}
      </svg>
    </section>
  )
}
