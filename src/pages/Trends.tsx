import { useMemo } from 'react'
import { useAppState } from '../hooks/useAppState'
import { useNow } from '../hooks/useNow'
import { TrendChart } from '../components/TrendChart'
import { dailySummaries, trendSeries } from '../lib/trends'
import type { DaySummary, TrendMetric } from '../lib/trends'
import { formatDayLabel, formatDuration } from '../lib/format'

/** How far back the comparison looks: today plus the week behind it */
const WINDOW_DAYS = 8

const CHARTS: Array<{ metric: TrendMetric; title: string; format: (v: number) => string }> = [
  { metric: 'milk', title: 'Milk in bottles', format: (v) => `${Math.round(v)} ml` },
  { metric: 'nursing', title: 'Nursing', format: (v) => formatDuration(v) },
  { metric: 'sleep', title: 'Sleep', format: (v) => formatDuration(v) },
  { metric: 'naps', title: 'Daytime naps', format: (v) => formatDuration(v) },
  { metric: 'nappies', title: 'Nappies', format: (v) => `${Math.round(v)}` },
  { metric: 'pumped', title: 'Pumped', format: (v) => `${Math.round(v)} ml` },
]

export function Trends() {
  const { state } = useAppState()
  const now = useNow(60_000)
  const summaries = useMemo(() => dailySummaries(state.log, WINDOW_DAYS, now), [state.log, now])
  // The same days trimmed to this time of day, so today is compared like for like
  const byNow = useMemo(
    () => dailySummaries(state.log, WINDOW_DAYS, now, true),
    [state.log, now],
  )

  const charts = CHARTS.map((chart) => ({
    ...chart,
    series: trendSeries(summaries, chart.metric, byNow),
  }))
    // A measure she has never had logged is not worth a chart of zeroes
    .filter((chart) => chart.series.max > 0)

  const logged = summaries.filter((s) => hasAnything(s))

  return (
    <main className="page">
      <header>
        <h1 className="page-title">By day</h1>
        <p className="page-subtitle">
          Today against the week behind it, compared at this time of day. Tap a bar to read it.
        </p>
      </header>

      {charts.length === 0 ? (
        <div className="empty">
          Nothing logged in the last week yet — a few days of entries and the comparison starts here.
        </div>
      ) : (
        charts.map((chart) => (
          <TrendChart
            key={chart.metric}
            series={chart.series}
            title={chart.title}
            format={chart.format}
          />
        ))
      )}

      {logged.length > 0 && <h2 className="section-title">Day by day</h2>}
      {logged.map((summary) => (
        <DayCard key={summary.day} summary={summary} />
      ))}
    </main>
  )
}

function hasAnything(summary: DaySummary): boolean {
  const t = summary.totals
  return (
    t.feeds > 0 || t.sleeps > 0 || t.nappyTotal > 0 || t.pumpSessions > 0 || t.medicines.length > 0
  )
}

/** The same numbers as the charts, written out — the readable record of a day */
function DayCard({ summary }: { summary: DaySummary }) {
  const t = summary.totals
  return (
    <section className={`card day-card${summary.isToday ? ' day-card-today' : ''}`}>
      <div className="row-between">
        <h3 className="item-title">{formatDayLabel(summary.day)}</h3>
        {summary.isToday && <span className="chip chip-good">so far</span>}
      </div>

      {t.nursingSessions > 0 && (
        <p className="day-line">
          <span className="day-key">Nursing</span> {formatDuration(t.nursingMinutes)} ·{' '}
          {t.nursingSessions}×
          <span className="faint">
            {' '}
            (L {formatDuration(t.leftMinutes)} · R {formatDuration(t.rightMinutes)})
          </span>
        </p>
      )}

      {t.bottles > 0 && (
        <p className="day-line">
          <span className="day-key">Bottles</span> {t.bottleMl} ml · {t.bottles}×
          <span className="faint">
            {t.formulaMl > 0 ? ` (formula ${t.formulaMl}` : ''}
            {t.formulaMl > 0 && t.expressedMl > 0 ? ', ' : ''}
            {t.expressedMl > 0 ? `${t.formulaMl > 0 ? '' : '('}breast milk ${t.expressedMl}` : ''}
            {t.formulaMl > 0 || t.expressedMl > 0 ? ')' : ''}
          </span>
        </p>
      )}

      {t.nappyTotal > 0 && (
        <p className="day-line">
          <span className="day-key">Nappies</span> {t.nappyTotal}×
          <span className="faint">
            {' '}
            (wet {t.nappies.wet} · poo {t.nappies.poo} · mixed {t.nappies.mixed})
          </span>
        </p>
      )}

      {t.sleeps > 0 && (
        <p className="day-line">
          <span className="day-key">Sleep</span> {formatDuration(t.sleepMinutes)} · {t.sleeps}×
          <span className="faint">
            {' '}
            (naps {formatDuration(summary.napMinutes)} · {summary.naps}×, longest{' '}
            {formatDuration(t.longestSleepMinutes)})
          </span>
        </p>
      )}

      {t.pumpSessions > 0 && (
        <p className="day-line">
          <span className="day-key">Pumped</span> {t.pumpedMl} ml · {t.pumpSessions}×
          {t.pumpedLeftMl > 0 || t.pumpedRightMl > 0 ? (
            <span className="faint">
              {' '}
              (L {t.pumpedLeftMl} · R {t.pumpedRightMl})
            </span>
          ) : null}
        </p>
      )}

      {t.medicines.length > 0 && (
        <p className="day-line">
          <span className="day-key">Medicine</span>{' '}
          {t.medicines.map((m) => (m.amount ? `${m.name} ${m.amount}` : m.name)).join(', ')}
        </p>
      )}
    </section>
  )
}
