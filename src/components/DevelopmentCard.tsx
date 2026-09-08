import { Link } from 'react-router-dom'
import { useAppState } from '../hooks/useAppState'
import { adjustedAgeInDays, ageInMonthsFloat, correctionDays, DAYS_PER_MONTH } from '../lib/age'
import { bandForAgeMonths } from '../data/milestones'

/**
 * What she is likely doing at this age — the developmental half of "how is she
 * growing", which is why it sits at the top of the Growth tab rather than on
 * Home. A baby born early is read at her adjusted age.
 */
export function DevelopmentCard() {
  const { state } = useAppState()
  const profile = state.profile!
  const corrDays = correctionDays(profile)
  const ageMonths =
    corrDays >= 14
      ? adjustedAgeInDays(profile) / DAYS_PER_MONTH
      : ageInMonthsFloat(profile.birthDate)
  const band = bandForAgeMonths(ageMonths)

  return (
    <section className="card card-tinted">
      <div className="row-between">
        <h2 className="item-title">What {profile.name} is likely doing now</h2>
        <span className="chip chip-neutral">{band.shortLabel}</span>
      </div>
      <p className="small" style={{ marginTop: 8 }}>
        {band.overview}
      </p>
      <Link to="/milestones" className="btn btn-ghost btn-sm" style={{ marginLeft: -12 }}>
        See her milestones →
      </Link>
    </section>
  )
}
