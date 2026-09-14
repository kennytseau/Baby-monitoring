import { useAppState } from '../hooks/useAppState'
import { useNow } from '../hooks/useNow'
import { forecastNeeds, type Need, type NeedsForecast } from '../lib/needs'
import { formatDuration } from '../lib/format'

/** "1 h 53 m" is one word to a reader, so do not let it wrap across two lines */
function duration(minutes: number): string {
  return formatDuration(minutes).replace(/ /g, ' ')
}

/**
 * What is coming next: when the next feed and the next change are likely, and
 * how much she will probably take. Read off her own recent log rather than a
 * chart of what a baby that age should do, so it keeps up as she grows.
 */
export function NeedsCard() {
  const { state } = useAppState()
  const now = useNow(30_000)
  const forecast = forecastNeeds(state.log, now)

  if (forecast.reason) {
    return (
      <section className="card">
        <p className="rhythm-label">Might be due</p>
        <p className="small muted">{forecast.reason}</p>
      </section>
    )
  }

  const rough = [forecast.feed, forecast.nappy].some((need) => need?.approximate)

  return (
    <section className="card" aria-live="polite">
      <p className="rhythm-label">Might be due</p>
      {forecast.feed && <NeedRow need={forecast.feed} asleep={forecast.asleep} />}
      {forecast.nappy && <NeedRow need={forecast.nappy} asleep={forecast.asleep} />}
      <p className="tiny faint" style={{ marginTop: 8 }}>
        From her own last fortnight — how long she goes at this hour, and how much she has been
        taking — so it moves as she grows. A guide, not a schedule.
        {rough ? ' Still thin on data at this hour, so treat these as rough.' : ''}
      </p>
    </section>
  )
}

function NeedRow({ need, asleep }: { need: Need; asleep: boolean }) {
  const feed = need.kind === 'feed'
  return (
    <div className="list-item">
      <span className="item-icon" aria-hidden="true">
        {feed ? '🍼' : '🧷'}
      </span>
      <div className="grow">
        <div className="item-title">{title(need, asleep)}</div>
        <div className="item-sub">{evidence(need)}</div>
      </div>
      {need.state !== 'settled' && (
        <span className={`chip ${need.state === 'soon' ? 'chip-neutral' : 'chip-warn'}`}>
          {need.state === 'soon' ? 'soon' : need.state === 'due' ? 'about now' : 'overdue'}
        </span>
      )}
    </div>
  )
}

/** What is coming — the amount if there is one, and when */
function title(need: Need, asleep: boolean): string {
  const what =
    need.kind === 'nappy'
      ? 'A change'
      : need.serving
        ? need.serving.unit === 'ml'
          ? `About ${need.serving.value} ml`
          : `About ${duration(need.serving.value)} nursing`
        : 'A feed'

  if (asleep && (need.state === 'due' || need.state === 'late')) return `${what} when she wakes`
  switch (need.state) {
    case 'late':
      return `${what}, due ${duration(-need.dueIn)} ago`
    case 'due':
      return `${what}, about now`
    default:
      return `${what} in about ${duration(need.dueIn)}`
  }
}

/** Why it says that: the last one, and how far apart they usually fall */
function evidence(need: Need): string {
  const last = need.kind === 'feed' ? 'Last feed' : 'Last change'
  return `${last} ${duration(need.since)} ago · usually ${duration(need.shortest)}–${duration(
    need.longest,
  )} apart`
}

/** Exported for tests: the exact line the card puts in front of a tired parent */
export function needLines(forecast: NeedsForecast): string[] {
  return [forecast.feed, forecast.nappy]
    .filter((need): need is Need => Boolean(need))
    .map((need) => `${title(need, forecast.asleep)} — ${evidence(need)}`)
}
