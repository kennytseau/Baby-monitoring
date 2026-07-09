import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../hooks/useAppState'
import { adjustedAgeInDays, ageInMonthsFloat, correctionDays, formatAge, parseISODate, DAYS_PER_MONTH } from '../lib/age'
import { bandForAgeMonths, findMilestone, nextBand } from '../data/milestones'
import { GROWTH_CURVES, MEASURE_INFO } from '../data/who-growth'
import { estimatePercentile, ordinal } from '../lib/percentiles'
import { dayOf, formatDuration, formatTime, todayISO } from '../lib/format'
import type { FeedEntry, FeedMethod, SleepEntry } from '../lib/types'
import { uid } from '../lib/storage'

export function Home() {
  const { state, addLog, updateLog, setProfile, exportData, resetAll } = useAppState()
  const profile = state.profile!
  const [confirmReset, setConfirmReset] = useState(false)

  const corrDays = correctionDays(profile)
  const usesAdjusted = corrDays >= 14
  const ageMonths = usesAdjusted
    ? adjustedAgeInDays(profile) / DAYS_PER_MONTH
    : ageInMonthsFloat(profile.birthDate)
  const band = bandForAgeMonths(ageMonths)
  const upcoming = nextBand(band)

  const achievedSet = useMemo(
    () => new Set(state.milestones.map((m) => m.milestoneId)),
    [state.milestones],
  )
  const recentWins = useMemo(
    () =>
      [...state.milestones]
        .sort((a, b) => b.achievedOn.localeCompare(a.achievedOn))
        .slice(0, 3)
        .map((rec) => ({ rec, def: findMilestone(rec.milestoneId) }))
        .filter((x) => x.def),
    [state.milestones],
  )
  const nextInBand = band.milestones.filter((m) => !achievedSet.has(m.id)).slice(0, 3)

  const today = todayISO()
  const todayLog = state.log.filter((e) => dayOf(e.time) === today)
  const feedsToday = todayLog.filter((e) => e.type === 'feed').length
  const diapersToday = todayLog.filter((e) => e.type === 'diaper').length
  const openSleep = state.log.find((e): e is SleepEntry => e.type === 'sleep' && !e.endTime)
  const sleepMinutesToday = state.log
    .filter((e): e is SleepEntry => e.type === 'sleep' && dayOf(e.time) === today)
    .reduce((total, e) => {
      const end = e.endTime ? new Date(e.endTime).getTime() : Date.now()
      return total + Math.max(0, (end - new Date(e.time).getTime()) / 60000)
    }, 0)

  const latestGrowth = useMemo(() => {
    const entries = [...state.growth].sort((a, b) => b.date.localeCompare(a.date))
    for (const entry of entries) {
      if (entry.weightKg != null) {
        const rows = GROWTH_CURVES[profile.sex].weight
        const at = ageInMonthsFloat(profile.birthDate, parseISODate(entry.date))
        return {
          entry,
          text: `${entry.weightKg} ${MEASURE_INFO.weight.unit}`,
          pct: estimatePercentile(rows, at, entry.weightKg),
        }
      }
    }
    return null
  }, [state.growth, profile.sex, profile.birthDate])

  function quickFeed() {
    const lastFeed = [...state.log].reverse().find((e): e is FeedEntry => e.type === 'feed')
    const method: FeedMethod = lastFeed ? lastFeed.method : 'breast-left'
    addLog({ id: uid(), type: 'feed', time: new Date().toISOString(), method })
  }
  function quickSleep() {
    if (openSleep) {
      updateLog({ ...openSleep, endTime: new Date().toISOString() })
    } else {
      addLog({ id: uid(), type: 'sleep', time: new Date().toISOString() })
    }
  }
  function quickDiaper() {
    addLog({ id: uid(), type: 'diaper', time: new Date().toISOString(), kind: 'wet' })
  }

  return (
    <main className="page">
      <header>
        <p className="page-subtitle">{greeting()}</p>
        <h1 className="age-hero">
          {profile.name} is {formatAge(profile.birthDate)}
        </h1>
        {usesAdjusted && (
          <p className="tiny muted">
            Born {Math.round(corrDays / 7)} weeks early — milestones use her adjusted age.
          </p>
        )}
      </header>

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

      <section>
        <h2 className="section-title">Quick log</h2>
        <div className="quick-btns" style={{ marginTop: 8 }}>
          <button className="quick-btn" onClick={quickFeed}>
            <span aria-hidden="true">🍼</span> Feed
          </button>
          <button className="quick-btn" onClick={quickSleep}>
            <span aria-hidden="true">😴</span> {openSleep ? 'Wake up' : 'Sleep'}
          </button>
          <button className="quick-btn" onClick={quickDiaper}>
            <span aria-hidden="true">🧷</span> Diaper
          </button>
        </div>
      </section>

      <section>
        <h2 className="section-title">Today</h2>
        <div className="stat-grid" style={{ marginTop: 8 }}>
          <div className="stat-tile">
            <span className="stat-value">{feedsToday}</span>
            <span className="stat-label">Feeds</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">
              {openSleep ? `zZ since ${formatTime(openSleep.time)}` : formatDuration(sleepMinutesToday)}
            </span>
            <span className="stat-label">Sleep</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{diapersToday}</span>
            <span className="stat-label">Diapers</span>
          </div>
        </div>
      </section>

      {nextInBand.length > 0 && (
        <section className="card">
          <h2 className="item-title">On the horizon</h2>
          <p className="tiny muted">From her current window ({band.label.toLowerCase()})</p>
          {nextInBand.map((m) => (
            <div className="list-item" key={m.id}>
              <div className="grow">
                <div className="item-title">{m.title}</div>
                <div className="item-sub">{m.howToEncourage[0]}</div>
              </div>
            </div>
          ))}
          {upcoming && (
            <p className="tiny faint" style={{ marginTop: 6 }}>
              Coming later: {upcoming.label.toLowerCase()} — {upcoming.milestones[0].title.toLowerCase()},{' '}
              {upcoming.milestones[1]?.title.toLowerCase()}…
            </p>
          )}
        </section>
      )}

      {recentWins.length > 0 && (
        <section className="card">
          <h2 className="item-title">Recent wins 🎉</h2>
          {recentWins.map(({ rec, def }) => (
            <div className="list-item" key={rec.milestoneId}>
              <div className="grow">
                <div className="item-title">{def!.milestone.title}</div>
                <div className="item-sub">
                  {formatAge(profile.birthDate, parseISODate(rec.achievedOn)).replace(' old', '')}
                </div>
              </div>
              <span className="chip chip-good">done</span>
            </div>
          ))}
        </section>
      )}

      {latestGrowth && (
        <section className="card">
          <div className="row-between">
            <div>
              <h2 className="item-title">Latest weight</h2>
              <p className="item-sub">
                {latestGrowth.text} — around the {ordinal(latestGrowth.pct)} percentile
              </p>
            </div>
            <Link to="/growth" className="btn btn-ghost btn-sm">
              Charts →
            </Link>
          </div>
        </section>
      )}

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Settings & data</summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <EditProfile />
          <button className="btn" onClick={exportData}>
            Download backup (JSON)
          </button>
          {confirmReset ? (
            <div className="row">
              <button
                className="btn btn-danger"
                onClick={() => {
                  setConfirmReset(false)
                  resetAll()
                }}
              >
                Yes, erase everything
              </button>
              <button className="btn" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
              Erase all data…
            </button>
          )}
          <p className="tiny faint">
            All data lives only in this browser. Download a backup before clearing your browser
            data or switching devices.
          </p>
        </div>
      </details>

      <p className="disclaimer">
        General information, not medical advice. Every baby develops at her own pace — talk to your
        pediatrician about anything that concerns you.
      </p>
    </main>
  )

  function EditProfile() {
    const [name, setName] = useState(profile.name)
    const [birthDate, setBirthDate] = useState(profile.birthDate)
    const [dueDate, setDueDate] = useState(profile.dueDate ?? '')
    const dirty =
      name !== profile.name || birthDate !== profile.birthDate || dueDate !== (profile.dueDate ?? '')
    return (
      <div className="stack">
        <div className="field-row">
          <div className="field">
            <label htmlFor="set-name">Name</label>
            <input id="set-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="set-birth">Birth date</label>
            <input
              id="set-birth"
              type="date"
              max={todayISO()}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="set-due">Due date (for adjusted age)</label>
          <input id="set-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        {dirty && (
          <button
            className="btn btn-primary btn-sm"
            disabled={!name.trim() || !birthDate}
            onClick={() =>
              setProfile({ ...profile, name: name.trim(), birthDate, dueDate: dueDate || undefined })
            }
          >
            Save profile
          </button>
        )}
      </div>
    )
  }
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Up in the night 🌙'
  if (h < 12) return 'Good morning ☀️'
  if (h < 18) return 'Good afternoon'
  return 'Good evening 🌙'
}
