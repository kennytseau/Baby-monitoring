import { useMemo } from 'react'
import { useAppState } from '../hooks/useAppState'
import { useNow } from '../hooks/useNow'
import { guidesForAge } from '../data/age-guides'
import type { AgeGuide, GuideId } from '../data/age-guides'
import { herWeek } from '../lib/insights'
import type { HerWeek } from '../lib/insights'
import { adjustedAgeInDays, ageInDays, developmentalAgeMonths, usesAdjustedAge } from '../lib/age'
import { formatDuration } from '../lib/format'

/**
 * What babies around her age typically do, beside her own last week. For
 * interest only: the app's predictions never read any of this.
 */
export function AgeGuidesCard() {
  const { state } = useAppState()
  const profile = state.profile!
  const now = useNow(60_000)
  const week = useMemo(() => herWeek(state.log, state.growth, now), [state.log, state.growth, now])
  const guides = guidesForAge(developmentalAgeMonths(profile, now), week.latestWeightKg)
  const weeks = Math.floor(
    (usesAdjustedAge(profile) ? adjustedAgeInDays(profile, now) : ageInDays(profile.birthDate, now)) / 7,
  )
  if (guides.length === 0) return null

  return (
    <section className="card guides-card">
      <div className="row-between">
        <h2 className="item-title">Babies around {weeks} weeks</h2>
        <span className="chip chip-neutral">for interest</span>
      </div>
      <p className="tiny muted">
        Typical ranges from published guidance, with {profile.name}'s last 7 days alongside. Every
        baby is different, and none of this feeds the app's predictions — those learn from her alone.
      </p>
      <dl className="guides">
        {guides.map((guide) => (
          <div key={guide.id} className="guide-row">
            <dt className="small">{guide.label}</dt>
            <dd className="guide-typical small">{guide.text}</dd>
            <dd className="guide-hers small">
              <span className="muted">{profile.name}: </span>
              {hers(guide, week)}
            </dd>
            <dd className="tiny faint">{guide.source}</dd>
          </div>
        ))}
      </dl>
      <p className="tiny muted">
        Anything worrying you is worth raising with your child health nurse or GP, whatever these
        say.
      </p>
    </section>
  )
}

const ONE_DECIMAL = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

function hers(guide: AgeGuide, week: HerWeek): string {
  const value = week.values[guide.id as GuideId]
  if (value == null) {
    if (guide.id === 'weight') return 'needs two weights 10 days to 6 weeks apart'
    if (guide.id === 'bottle') return 'no bottles logged'
    return 'not enough logged yet'
  }
  switch (guide.id) {
    case 'sleep':
    case 'wake':
      return `${formatDuration(value)}${guide.id === 'wake' ? ' typically' : ' a day'}`
    case 'bottle':
      return `${Math.round(value)} ml a day${week.alsoNursed ? ', plus nursing, which isn’t measured in ml' : ''}`
    case 'weight':
      return `${value} g a week lately`
    default:
      return `${ONE_DECIMAL.format(value)} a day`
  }
}
