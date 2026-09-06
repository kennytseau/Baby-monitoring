import { dayOf, minutesIntoDay } from '../lib/format'
import type { LogEntry, SleepEntry } from '../lib/types'

const DAY_MINUTES = 1440
const W = 720
const H = 56
const SLEEP_TOP = 6
const SLEEP_H = 20
const MARK_Y = 38

const MARK_CLASS: Record<Exclude<LogEntry['type'], 'sleep'>, string> = {
  feed: 'dt-feed',
  nappy: 'dt-nappy',
  pump: 'dt-pump',
}

/**
 * A 24-hour strip for one day: sleeps as bars (so the wake windows are the gaps
 * between them) and feeds / nappies / pumping as marks underneath.
 */
export function DayTimeline({ day, entries, now }: { day: string; entries: LogEntry[]; now: Date }) {
  const x = (minutes: number) => (minutes / DAY_MINUTES) * W

  const sleeps = entries
    .filter((e): e is SleepEntry => e.type === 'sleep')
    .map((e) => {
      const start = minutesIntoDay(e.time)
      const endIso = e.endTime ?? now.toISOString()
      // A sleep that runs past midnight is drawn to the end of its own day
      const end = dayOf(endIso) === day ? minutesIntoDay(endIso) : DAY_MINUTES
      return { id: e.id, start, end: Math.max(end, start + 2) }
    })

  const marks = entries
    .filter((e): e is Exclude<LogEntry, SleepEntry> => e.type !== 'sleep')
    .map((e) => ({ id: e.id, type: e.type, at: minutesIntoDay(e.time) }))

  return (
    <svg className="day-timeline" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="24-hour timeline">
      <rect className="dt-track" x="0" y={SLEEP_TOP} width={W} height={SLEEP_H} rx="6" />
      {[0, 6, 12, 18, 24].map((hour) => (
        <g key={hour}>
          <line className="dt-grid" x1={x(hour * 60)} y1={SLEEP_TOP} x2={x(hour * 60)} y2={MARK_Y + 6} />
          <text
            className="dt-tick"
            x={Math.min(Math.max(x(hour * 60), 10), W - 10)}
            y={H - 2}
            textAnchor={hour === 0 ? 'start' : hour === 24 ? 'end' : 'middle'}
          >
            {hour === 24 ? '24h' : `${hour}`}
          </text>
        </g>
      ))}
      {sleeps.map((s) => (
        <rect
          key={s.id}
          className="dt-sleep"
          x={x(s.start)}
          y={SLEEP_TOP}
          width={x(s.end) - x(s.start)}
          height={SLEEP_H}
          rx="6"
        />
      ))}
      {marks.map((m) => (
        <circle key={m.id} className={MARK_CLASS[m.type]} cx={x(m.at)} cy={MARK_Y} r="5" />
      ))}
    </svg>
  )
}
