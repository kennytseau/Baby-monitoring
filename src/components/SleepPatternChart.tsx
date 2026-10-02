import { useState } from 'react'
import type { PatternDay } from '../lib/pattern'
import { formatDuration, formatTime, minutesIntoDay } from '../lib/format'
import { parseISODate } from '../lib/age'

/**
 * Her days stacked on one 24-hour line, today at the top: sleep as bars and
 * feeds as dots. A rhythm shows up as the bars lining up down the page.
 *
 * Two series, so there is a legend; the colours are shared with the daily
 * log's strip so sleep and feeds look the same everywhere.
 */
const WIDTH = 360
const LABEL = 42
/** Room at the right for a feed dot at midnight, ring and all */
const PLOT = WIDTH - LABEL - 7
const AXIS = 16
const ROW = 22
/** Bars stay thin enough to leave the gap between days readable */
const BAR = 14
const FEED_R = 4
const DAY_MINUTES = 24 * 60
const TICKS: Array<{ minutes: number; label: string }> = [
  { minutes: 0, label: '12am' },
  { minutes: 360, label: '6am' },
  { minutes: 720, label: 'noon' },
  { minutes: 1080, label: '6pm' },
  { minutes: 1440, label: '12am' },
]
const ROW_LABEL = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' })

type Selection = { row: number; kind: 'sleep' | 'feed'; index: number }

export function SleepPatternChart({ days, now }: { days: PatternDay[]; now: Date }) {
  const [selected, setSelected] = useState<Selection | null>(null)
  if (days.length === 0) return null

  const x = (minutes: number) => LABEL + (minutes / DAY_MINUTES) * PLOT
  const rowTop = (row: number) => AXIS + row * ROW
  const height = AXIS + days.length * ROW
  const toggle = (next: Selection) =>
    setSelected(
      selected && selected.row === next.row && selected.kind === next.kind && selected.index === next.index
        ? null
        : next,
    )

  return (
    <section className="card trend-card">
      <div className="row-between">
        <h3 className="trend-title">Sleep and feeds</h3>
        <span className="sp-legend tiny muted">
          <span className="sp-key">
            <span className="sp-swatch sp-swatch-sleep" /> Sleep
          </span>
          <span className="sp-key">
            <span className="sp-swatch sp-swatch-feed" /> Feed
          </span>
        </span>
      </div>

      <svg
        className="sp-svg"
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={`Sleep and feeds over the last ${days.length} days, today at the top. The table below has the same days.`}
      >
        {TICKS.map((tick) => (
          <g key={tick.minutes}>
            <line className="sp-grid" x1={x(tick.minutes)} y1={AXIS - 2} x2={x(tick.minutes)} y2={height} />
            <text
              className="sp-tick"
              x={x(tick.minutes)}
              y={AXIS - 5}
              textAnchor={tick.minutes === 0 ? 'start' : tick.minutes === DAY_MINUTES ? 'end' : 'middle'}
            >
              {tick.label}
            </text>
          </g>
        ))}

        {days.map((day, row) => {
          const top = rowTop(row)
          const mid = top + ROW / 2
          return (
            <g key={day.day}>
              <text className={day.isToday ? 'sp-day sp-day-today' : 'sp-day'} x="0" y={mid + 4}>
                {day.isToday ? 'Today' : ROW_LABEL.format(parseISODate(day.day))}
              </text>
              <rect className="sp-track" x={LABEL} y={mid - BAR / 2} width={PLOT} height={BAR} rx="4" />

              {day.sleeps.map((sleep, i) => {
                const width = Math.max(x(sleep.end) - x(sleep.start), 2)
                const on = selected?.row === row && selected.kind === 'sleep' && selected.index === i
                return (
                  <g key={`s${i}`} onClick={() => toggle({ row, kind: 'sleep', index: i })}>
                    {/* A hit target the full row high and never narrower than a thumb */}
                    <rect
                      x={x(sleep.start) + width / 2 - Math.max(width, 16) / 2}
                      y={top}
                      width={Math.max(width, 16)}
                      height={ROW}
                      fill="transparent"
                    />
                    <rect
                      className={on ? 'sp-sleep sp-on' : 'sp-sleep'}
                      x={x(sleep.start)}
                      y={mid - BAR / 2}
                      width={width}
                      height={BAR}
                      rx={Math.min(4, width / 2)}
                    />
                  </g>
                )
              })}

              {day.feeds.map((feed, i) => {
                const on = selected?.row === row && selected.kind === 'feed' && selected.index === i
                return (
                  <g key={`f${i}`} onClick={() => toggle({ row, kind: 'feed', index: i })}>
                    <circle cx={x(feed.at)} cy={mid} r="11" fill="transparent" />
                    <circle
                      className={on ? 'sp-feed sp-on' : 'sp-feed'}
                      cx={x(feed.at)}
                      cy={mid}
                      r={on ? FEED_R + 1 : FEED_R}
                    />
                  </g>
                )
              })}

              {day.isToday && (
                <line
                  className="sp-now"
                  x1={x(minutesIntoDay(now))}
                  y1={top + 1}
                  x2={x(minutesIntoDay(now))}
                  y2={top + ROW - 1}
                />
              )}
            </g>
          )
        })}
      </svg>

      <p className="tiny muted sp-detail" aria-live="polite">
        {selected ? describe(days[selected.row], selected) : 'Tap a sleep or a feed to read it.'}
      </p>

      <details className="sp-table">
        <summary className="tiny muted">As a table</summary>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Asleep</th>
              <th>Longest</th>
              <th>Feeds</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.day}>
                <td>{day.isToday ? 'Today' : ROW_LABEL.format(parseISODate(day.day))}</td>
                <td>{day.asleepMinutes > 0 ? formatDuration(day.asleepMinutes) : '—'}</td>
                <td>{day.longestMinutes > 0 ? formatDuration(day.longestMinutes) : '—'}</td>
                <td>{day.feeds.length || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tiny faint">
          Asleep is midnight to midnight; the longest sleep counts in full on the day it began.
        </p>
      </details>
    </section>
  )
}

function describe(day: PatternDay, selection: Selection): string {
  if (selection.kind === 'sleep') {
    const sleep = day.sleeps[selection.index]
    const minutes = (sleep.to.getTime() - sleep.from.getTime()) / 60_000
    return sleep.open
      ? `Asleep since ${formatTime(sleep.from)} · ${formatDuration(minutes)} so far`
      : `Slept ${formatTime(sleep.from)} – ${formatTime(sleep.to)} · ${formatDuration(minutes)}`
  }
  const feed = day.feeds[selection.index]
  const parts = [`Fed at ${formatTime(feed.time)}`]
  if (feed.ml > 0) parts.push(`${feed.ml} ml`)
  if (feed.nursingMinutes > 0) parts.push(`nursed ${formatDuration(feed.nursingMinutes)}`)
  if (feed.entries > 1) parts.push(`${feed.entries} entries, top-ups counted in`)
  return parts.join(' · ')
}
