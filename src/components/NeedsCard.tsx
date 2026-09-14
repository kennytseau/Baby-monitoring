import { useAppState } from '../hooks/useAppState'
import { useNow } from '../hooks/useNow'
import { forecastNeeds, type Need, type NeedsForecast } from '../lib/needs'
import { formatDuration } from '../lib/format'

/** "1 h 53 m" is one word to a reader, so do not let it wrap across two lines */
function duration(minutes: number): string {
  return formatDuration(minutes).replace(/ /g, '\u00a0')
}

/**
 * The two questions a parent actually asks between logs: should I feed her,
 * should I change her. Both answers are read off how long she has been going
 * lately at this hour of the day, so they move with her as she grows rather
 * than against a chart of what a baby "should" do.
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
        From her own last fortnight at this time of day, so it moves as she grows — a guide, not a
        schedule.{rough ? ' Still thin on data at this hour, so treat these as rough.' : ''}
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

function title(need: Need, asleep: boolean): string {
  const feed = need.kind === 'feed'
  switch (need.state) {
    case 'late':
      if (asleep) return feed ? 'Hungry when she wakes' : 'Worth a check when she wakes'
      return feed ? 'Probably hungry' : 'Worth a nappy check'
    case 'due':
      if (asleep) return feed ? 'A feed due when she wakes' : 'A change due when she wakes'
      return feed ? 'Probably ready for a feed' : 'Probably ready for a change'
    case 'soon':
      return `${feed ? 'Feed' : 'Change'} likely in about ${duration(need.dueIn)}`
    case 'settled':
      return `${feed ? 'Fed' : 'Changed'} ${duration(need.since)} ago`
  }
}

function evidence(need: Need): string {
  const thing = need.kind === 'feed' ? 'feeds' : 'changes'
  if (need.state === 'settled') {
    return `Usually about ${duration(need.usual)} between ${thing} at this hour`
  }
  return `${duration(need.since)} since the last one · usually ${duration(need.shortest)}–${duration(
    need.longest,
  )}`
}

/** Exported for tests: the exact line the card puts in front of a tired parent */
export function needLines(forecast: NeedsForecast): string[] {
  return [forecast.feed, forecast.nappy]
    .filter((need): need is Need => Boolean(need))
    .map((need) => `${title(need, forecast.asleep)} — ${evidence(need)}`)
}
