import { useMemo } from 'react'
import { useAppState } from '../hooks/useAppState'
import { findMilestone } from '../data/milestones'
import { formatAge, parseISODate } from '../lib/age'

/** How many of the newest achievements to show */
const SHOWN = 3

/**
 * The milestones she has reached most recently, newest first, each with how old
 * she was when she did it. Nothing renders until she has reached one.
 */
export function RecentWins() {
  const { state } = useAppState()
  const profile = state.profile!

  const wins = useMemo(
    () =>
      [...state.milestones]
        .sort((a, b) => b.achievedOn.localeCompare(a.achievedOn))
        .slice(0, SHOWN)
        .map((record) => ({ record, found: findMilestone(record.milestoneId) }))
        .filter((win) => win.found),
    [state.milestones],
  )

  if (wins.length === 0) return null

  return (
    <section className="card">
      <h2 className="item-title">Recent wins 🎉</h2>
      {wins.map(({ record, found }) => (
        <div className="list-item" key={record.milestoneId}>
          <div className="grow">
            <div className="item-title">{found!.milestone.title}</div>
            <div className="item-sub">
              {formatAge(profile.birthDate, parseISODate(record.achievedOn)).replace(' old', '')}
            </div>
          </div>
          <span className="chip chip-good">done</span>
        </div>
      ))}
    </section>
  )
}
