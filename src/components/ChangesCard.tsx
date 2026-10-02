import { useMemo } from 'react'
import { useAppState } from '../hooks/useAppState'
import { useNow } from '../hooks/useNow'
import {
  dailyMeasures,
  NEWS_DAYS,
  patternChanges,
  REGRESSION_DAYS,
  REGRESSION_UNTIL_WEEKS,
  regressionWatch,
  type DayMeasures,
  type PatternChange,
  type RegressionWatch,
} from '../lib/changes'
import { adjustedAgeInDays, ageInDays, usesAdjustedAge } from '../lib/age'
import { formatDuration } from '../lib/format'
import { quantile } from '../lib/patterns'

/**
 * What has shifted in her pattern lately, and whether it looks like the
 * 4-month sleep regression. Read off her own log against her own fortnight
 * before; none of it changes a prediction.
 */
function usePatterns() {
  const { state } = useAppState()
  const profile = state.profile!
  const now = useNow(60_000)
  const measures = useMemo(() => dailyMeasures(state.log, now), [state.log, now])
  const changes = useMemo(() => patternChanges(measures, now), [measures, now])
  const ageWeeks = Math.floor(
    (usesAdjustedAge(profile) ? adjustedAgeInDays(profile, now) : ageInDays(profile.birthDate, now)) / 7,
  )
  const regression = useMemo(
    () => regressionWatch(patternChanges(measures, now, REGRESSION_DAYS), ageWeeks),
    [measures, now, ageWeeks],
  )
  return { measures, changes, regression, ageWeeks }
}

/** Home: only when something has changed, so it means something when it is there */
export function ChangesCard() {
  const { changes, regression } = usePatterns()
  const flagged = regression.state === 'possible' || regression.state === 'likely'
  if (changes.length === 0 && !flagged) return null
  return (
    <section className="card" aria-live="polite">
      <p className="rhythm-label">What's changed</p>
      {flagged && <RegressionHeadline watch={regression} />}
      {changes.map((change) => (
        <ChangeRow key={change.measure} change={change} />
      ))}
      <p className="tiny faint" style={{ marginTop: 8 }}>
        Each against her usual in the fortnight before it began. More on the By day tab.
      </p>
    </section>
  )
}

/** By day: the full picture, including when nothing has changed */
export function PatternsSection() {
  const { measures, changes, regression, ageWeeks } = usePatterns()
  return (
    <>
      <section className="card">
        <p className="rhythm-label">What's changed</p>
        {changes.length === 0 ? (
          <p className="small muted">
            Nothing has shifted lately — her last 3 days look like the fortnight before them.
          </p>
        ) : (
          changes.map((change) => <ChangeRow key={change.measure} change={change} />)
        )}
        <p className="tiny faint" style={{ marginTop: 8 }}>
          A change has to hold for 3 days in a row, each one outside the middle half of her usual
          spread, and by enough to matter. It shows for up to {NEWS_DAYS / 7} weeks; after that it is her
          new normal, and the predictions on Home have caught up with it.
        </p>
      </section>
      {regression.state !== 'outside' && (
        <RegressionCard watch={regression} measures={measures} ageWeeks={ageWeeks} />
      )}
    </>
  )
}

const NAMES: Record<PatternChange['measure'], { icon: string; up: string; down: string }> = {
  longestNight: {
    icon: '🌙',
    up: 'Her longest night stretch is longer',
    down: 'Her longest night stretch is shorter',
  },
  nightWakings: { icon: '🌙', up: 'She is waking more at night', down: 'She is waking less at night' },
  nightSleep: { icon: '🌙', up: 'More sleep overnight', down: 'Less sleep overnight' },
  napLength: { icon: '😴', up: 'Her naps are longer', down: 'Her naps are shorter' },
  daySleep: { icon: '😴', up: 'More sleep in the day', down: 'Less sleep in the day' },
  feeds: { icon: '🍼', up: 'She is feeding more often', down: 'She is feeding less often' },
}

const ONE_DECIMAL = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

function amount(change: PatternChange, value: number): string {
  switch (change.measure) {
    case 'nightWakings':
      return `${ONE_DECIMAL.format(value)} wakings a night`
    case 'feeds':
      return `${ONE_DECIMAL.format(value)} feeds a day`
    case 'napLength':
      return `${formatDuration(value)} naps`
    default:
      return formatDuration(value)
  }
}

function ChangeRow({ change }: { change: PatternChange }) {
  const label = NAMES[change.measure]
  const days = change.days.length
  return (
    <div className="list-item">
      <span className="item-icon" aria-hidden="true">
        {label.icon}
      </span>
      <div className="grow">
        <div className="item-title">{change.direction === 'up' ? label.up : label.down}</div>
        <div className="item-sub">
          {amount(change, change.lately)} lately, usually {amount(change, change.usual)} · {days}{' '}
          days running
          {change.measure === 'feeds' && change.direction === 'up' ? ' — often a growth spurt' : ''}
        </div>
      </div>
    </div>
  )
}

function RegressionHeadline({ watch }: { watch: RegressionWatch }) {
  return (
    <div className="list-item">
      <span className="item-icon" aria-hidden="true">
        🌀
      </span>
      <div className="grow">
        <div className="item-title">
          {watch.state === 'likely'
            ? 'Looks like the 4-month sleep regression'
            : 'Could be the start of the 4-month sleep regression'}
        </div>
        <div className="item-sub">The signs are below.</div>
      </div>
      <span className={`chip ${watch.state === 'likely' ? 'chip-warn' : 'chip-neutral'}`}>
        {watch.state}
      </span>
    </div>
  )
}

/** When it is commonly said to start, for the wording; the watch itself runs a little wider */
const COMMON_FROM_WEEKS = 12
const COMMON_UNTIL_WEEKS = 20

const STATE_TITLE: Record<Exclude<RegressionWatch['state'], 'outside'>, string> = {
  watching: 'No signs yet',
  possible: 'Maybe starting',
  likely: 'Likely started',
}

function RegressionCard({
  watch,
  measures,
  ageWeeks,
}: {
  watch: RegressionWatch
  measures: DayMeasures[]
  ageWeeks: number
}) {
  if (watch.state === 'outside') return null
  const nights = measures.filter((m) => m.values.longestNight != null).slice(-3)
  const typical = (key: 'longestNight' | 'nightWakings') =>
    quantile(nights.map((m) => m.values[key]!).sort((a, b) => a - b), 0.5)
  const since = watch.signs.reduce((longest, s) => Math.max(longest, s.days.length), 0)

  return (
    <section className="card">
      <div className="row-between">
        <p className="rhythm-label">4-month sleep regression watch</p>
        <span
          className={`chip ${watch.state === 'likely' ? 'chip-warn' : watch.state === 'possible' ? 'chip-neutral' : 'chip-good'}`}
        >
          {STATE_TITLE[watch.state]}
        </span>
      </div>
      <p className="small" style={{ marginTop: 6 }}>
        {ageWeeks < COMMON_FROM_WEEKS
          ? `It commonly starts between about ${COMMON_FROM_WEEKS} and ${COMMON_UNTIL_WEEKS} weeks (3 to 5 months), and she is ${ageWeeks} weeks, so it is worth watching from now.`
          : ageWeeks <= COMMON_UNTIL_WEEKS
            ? `At ${ageWeeks} weeks she is right in the stretch when it commonly starts, about ${COMMON_FROM_WEEKS} to ${COMMON_UNTIL_WEEKS} weeks (3 to 5 months).`
            : `It commonly starts by about ${COMMON_UNTIL_WEEKS} weeks and she is ${ageWeeks}, so it is less likely now, but still watched until ${REGRESSION_UNTIL_WEEKS} weeks.`}{' '}
        When it starts is not something any log can tell in advance, so this watches for its signs
        instead: more night wakings, a shorter longest stretch, and naps cut to one
        sleep cycle (45 minutes or less), held for 3 nights or more.
      </p>
      {watch.state === 'watching' ? (
        nights.length === 3 && (
          <p className="small muted" style={{ marginTop: 6 }}>
            Her last 3 nights: longest stretch {formatDuration(typical('longestNight'))},{' '}
            {ONE_DECIMAL.format(typical('nightWakings'))} wakings a night — nothing out of her
            usual.
          </p>
        )
      ) : (
        <>
          <ul className="small regression-signs">
            {watch.signs.map((sign) => (
              <li key={sign.measure}>
                {sign.direction === 'up' ? NAMES[sign.measure].up : NAMES[sign.measure].down}:{' '}
                {amount(sign, sign.lately)}, usually {amount(sign, sign.usual)}
              </li>
            ))}
          </ul>
          <p className="small muted">
            {since} days so far. It is a lasting change in how her sleep cycles work rather than a
            step backwards, and it commonly settles within 2 to 6 weeks. Commonly suggested: keep
            the bedtime routine the same, watch for her getting overtired, and give her a moment to
            resettle between cycles before going in.
          </p>
        </>
      )}
      <p className="tiny faint" style={{ marginTop: 6 }}>
        Not used by the predictions, and not medical advice — if her sleep is worrying you, your
        child health nurse or GP is the person to ask.
      </p>
    </section>
  )
}
