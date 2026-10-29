import { useAppState, usePronouns } from '../hooks/useAppState'
import { useNow } from '../hooks/useNow'
import { usePatterns } from '../hooks/usePatterns'
import { forecastRhythm } from '../lib/rhythm'
import { sleepHistoryDays } from '../lib/changes'
import { timingOf } from '../lib/needs'
import { formatDuration, formatTime } from '../lib/format'

/** Closer than this and "in about 3 minutes" is a precision the data does not have */
const IMMINENT_MINUTES = 5

/**
 * The next thing to expect, at the top of Home: when she is likely to wake, or
 * when she is likely to be ready to go down. Both are read off her own logged
 * rhythm at this time of day, and both come with the range they were drawn
 * from — a baby is not a train timetable. While her nights are changing, the
 * wake-up learns only from the days since the change began.
 */
export function RhythmCard() {
  const { state } = useAppState()
  const p = usePronouns()
  const now = useNow(30_000)
  const historyDays = sleepHistoryDays(usePatterns().changes)
  const forecast = forecastRhythm(state.log, now, historyDays)

  if (forecast.reason) {
    return (
      <section className="card rhythm-card">
        <p className="rhythm-label">What's next</p>
        <p className="small muted">{p(forecast.reason)}</p>
      </section>
    )
  }

  const prediction = forecast.wakeUp ?? forecast.windDown
  if (!prediction) return null

  // The time is fixed when the sleep or wake window begins and does not move,
  // so once it has gone by the card says so rather than chasing the clock.
  const minutesAway = (prediction.at.getTime() - now.getTime()) / 60_000
  const passed = minutesAway <= -IMMINENT_MINUTES
  // Awake and nearing or past her usual wind-down: coloured in day mode, as a
  // likely reason for grizzling (see the stylesheet). Not for wake-ups.
  const timing = forecast.asleep ? undefined : timingOf(minutesAway)

  return (
    <section className={`card rhythm-card${timing ? ` timing-${timing}` : ''}`} aria-live="polite">
      <div className="row-between">
        <p className="rhythm-label">
          <span aria-hidden="true">{forecast.asleep ? '😴' : '☀️'}</span>{' '}
          {forecast.asleep ? 'Likely to wake' : 'Ready for sleep'}
        </p>
        {prediction.approximate && <span className="chip chip-neutral">rough guess</span>}
      </div>

      <p className="rhythm-time">{formatTime(prediction.at)}</p>
      <p className="small">
        {passed
          ? `Any time now — ${formatDuration(-minutesAway)} past ${
              p(forecast.asleep ? '{his} usual wake-up' : '{his} usual wind-down')
            }`
          : minutesAway < IMMINENT_MINUTES
            ? 'Any time now'
            : `in about ${formatDuration(minutesAway)}`}
      </p>
      {prediction.afterShortNap ? (
        <p className="tiny faint">
          Sooner than usual: after a nap of {formatDuration(prediction.afterShortNap.napMinutes)}{' '}
          {p('{he}')} has been staying up about {Math.round(prediction.afterShortNap.factor * 100)}% as long. Likely{' '}
          {formatTime(prediction.earliest)}–{formatTime(prediction.latest)}.
        </p>
      ) : (
        <p className="tiny faint">
          Usually {formatTime(prediction.earliest)}–{formatTime(prediction.latest)}, from{' '}
          {prediction.samples} similar {forecast.asleep ? 'sleeps' : 'wake windows'} at this time of day.
        </p>
      )}
      {forecast.asleep && historyDays && (
        <p className="tiny faint">
          {p('{His}')} nights have changed lately, so this goes by {p('{his}')} last {historyDays} days
          only.
        </p>
      )}
    </section>
  )
}
