import { useAppState } from '../hooks/useAppState'
import { useNow } from '../hooks/useNow'
import { forecastRhythm } from '../lib/rhythm'
import { formatDuration, formatTime } from '../lib/format'

/** Closer than this and "in about 3 minutes" is a precision the data does not have */
const IMMINENT_MINUTES = 5

/**
 * The next thing to expect, at the top of Home: when she is likely to wake, or
 * when she is likely to be ready to go down. Both are read off her own logged
 * rhythm at this time of day, and both come with the range they were drawn
 * from — a baby is not a train timetable.
 */
export function RhythmCard() {
  const { state } = useAppState()
  const now = useNow(30_000)
  const forecast = forecastRhythm(state.log, now)

  if (forecast.reason) {
    return (
      <section className="card rhythm-card">
        <p className="rhythm-label">What's next</p>
        <p className="small muted">{forecast.reason}</p>
      </section>
    )
  }

  const prediction = forecast.wakeUp ?? forecast.windDown
  if (!prediction) return null

  // The estimate counts the time she has already been down or awake, so it
  // only lands in the past when the log has not been kept up.
  const minutesAway = (prediction.at.getTime() - now.getTime()) / 60_000
  const overdue = minutesAway <= -IMMINENT_MINUTES

  return (
    <section className="card rhythm-card" aria-live="polite">
      <div className="row-between">
        <p className="rhythm-label">
          <span aria-hidden="true">{forecast.asleep ? '😴' : '☀️'}</span>{' '}
          {forecast.asleep ? 'Likely to wake' : 'Ready for sleep'}
        </p>
        {prediction.approximate && <span className="chip chip-neutral">rough guess</span>}
      </div>

      <p className="rhythm-time">{formatTime(prediction.at)}</p>
      <p className="small">
        {overdue
          ? forecast.asleep
            ? `Any time now — ${formatDuration(-minutesAway)} past her usual`
            : `Wind-down window opened ${formatDuration(-minutesAway)} ago`
          : minutesAway < IMMINENT_MINUTES
            ? 'any time now'
            : `in about ${formatDuration(minutesAway)}`}
      </p>
      <p className="tiny faint">
        Usually {formatTime(prediction.earliest)}–{formatTime(prediction.latest)}, from{' '}
        {prediction.samples} similar {forecast.asleep ? 'sleeps' : 'wake windows'} at this time of day.
      </p>
    </section>
  )
}
