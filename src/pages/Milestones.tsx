import { useMemo, useState } from 'react'
import { useAppState } from '../hooks/useAppState'
import { AGE_BANDS, CATEGORY_LABELS, bandForAgeMonths } from '../data/milestones'
import type { AgeBand, MilestoneDef } from '../data/milestones'
import { adjustedAgeInDays, ageInMonthsFloat, correctionDays, DAYS_PER_MONTH } from '../lib/age'
import { formatDate, todayISO } from '../lib/format'

export function Milestones() {
  const { state } = useAppState()
  const profile = state.profile!

  const corrDays = correctionDays(profile)
  const ageMonths =
    corrDays >= 14 ? adjustedAgeInDays(profile) / DAYS_PER_MONTH : ageInMonthsFloat(profile.birthDate)
  const currentBand = bandForAgeMonths(ageMonths)

  const achieved = useMemo(() => {
    const map = new Map<string, string>()
    for (const rec of state.milestones) map.set(rec.milestoneId, rec.achievedOn)
    return map
  }, [state.milestones])

  const [openBands, setOpenBands] = useState<Set<string>>(() => new Set([currentBand.id]))

  function toggleBand(id: string) {
    setOpenBands((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <main className="page">
      <header>
        <h1 className="page-title">Milestones</h1>
        <p className="page-subtitle">
          What most babies do by each age, and how to help {profile.name} get there. Tap a milestone
          for ideas; tap the circle when she does it.
        </p>
      </header>

      {AGE_BANDS.map((band) => (
        <BandCard
          key={band.id}
          band={band}
          isCurrent={band.id === currentBand.id}
          isOpen={openBands.has(band.id)}
          onToggle={() => toggleBand(band.id)}
          achieved={achieved}
        />
      ))}

      <p className="disclaimer">
        Based on the CDC "Learn the Signs. Act Early." checklists — what 75% or more of babies do by
        each age. Every baby develops at her own pace; this is not medical advice. If she misses
        milestones or loses skills she had, talk to your pediatrician.
      </p>
    </main>
  )
}

function BandCard({
  band,
  isCurrent,
  isOpen,
  onToggle,
  achieved,
}: {
  band: AgeBand
  isCurrent: boolean
  isOpen: boolean
  onToggle: () => void
  achieved: Map<string, string>
}) {
  const doneCount = band.milestones.filter((m) => achieved.has(m.id)).length
  return (
    <section className={`card${isCurrent ? ' card-tinted' : ''}`}>
      <button className="band-header" onClick={onToggle} aria-expanded={isOpen}>
        <div className="grow">
          <div className="row">
            <span className="band-title">{band.label}</span>
            {isCurrent && <span className="chip chip-good">now</span>}
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${(doneCount / band.milestones.length) * 100}%` }}
              />
            </div>
            <span className="tiny muted">
              {doneCount}/{band.milestones.length}
            </span>
          </div>
        </div>
        <span className="muted" aria-hidden="true">
          {isOpen ? '▾' : '▸'}
        </span>
      </button>

      {isOpen && (
        <div style={{ marginTop: 10 }}>
          <p className="small muted">{band.overview}</p>
          {band.milestones.map((m) => (
            <MilestoneRow key={m.id} milestone={m} achievedOn={achieved.get(m.id)} />
          ))}
        </div>
      )}
    </section>
  )
}

function MilestoneRow({ milestone, achievedOn }: { milestone: MilestoneDef; achievedOn?: string }) {
  const { setMilestoneAchieved } = useAppState()
  const [expanded, setExpanded] = useState(false)
  const done = achievedOn != null

  return (
    <div className="milestone">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <button
          className={`milestone-check${done ? ' done' : ''}`}
          aria-label={done ? `Unmark "${milestone.title}"` : `Mark "${milestone.title}" as achieved`}
          onClick={() => setMilestoneAchieved(milestone.id, done ? null : todayISO())}
        >
          ✓
        </button>
        <button
          className="band-header grow"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          <div className="grow">
            <div className="item-title" style={done ? { opacity: 0.65 } : undefined}>
              {milestone.title}
            </div>
            <div className="row" style={{ marginTop: 3, flexWrap: 'wrap', gap: 6 }}>
              <span className={`chip chip-${milestone.category}`}>
                {CATEGORY_LABELS[milestone.category]}
              </span>
              {done && <span className="tiny muted">achieved {formatDate(achievedOn)}</span>}
            </div>
          </div>
        </button>
      </div>

      {expanded && (
        <div style={{ marginLeft: 38 }}>
          <p className="small muted" style={{ marginTop: 8 }}>
            {milestone.description}
          </p>
          <div className="how-to">
            <strong>How to get there</strong>
            <ul>
              {milestone.howToEncourage.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
          {done && (
            <div className="field" style={{ marginTop: 10, maxWidth: 220 }}>
              <label htmlFor={`date-${milestone.id}`}>Achieved on</label>
              <input
                id={`date-${milestone.id}`}
                type="date"
                value={achievedOn}
                max={todayISO()}
                onChange={(e) => e.target.value && setMilestoneAchieved(milestone.id, e.target.value)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
