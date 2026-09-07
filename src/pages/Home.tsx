import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../hooks/useAppState'
import { adjustedAgeInDays, ageInMonthsFloat, correctionDays, formatAge, parseISODate, DAYS_PER_MONTH } from '../lib/age'
import { bandForAgeMonths, findMilestone, nextBand } from '../data/milestones'
import { GROWTH_CURVES, MEASURE_INFO } from '../data/who-growth'
import { estimatePercentile, ordinal } from '../lib/percentiles'
import { dayOf, formatAgo, formatDuration, formatTime, todayISO } from '../lib/format'
import { QuickLog } from '../components/QuickLog'
import { RhythmCard } from '../components/RhythmCard'
import { SharingPanel } from '../components/SharingPanel'
import { DayTotalsCard } from '../components/DayTotalsCard'
import { useNow } from '../hooks/useNow'
import { currentWakeMinutes, dayTotals, findOpenSleep, sleepMinutes, sortedByTime } from '../lib/log'

export function Home() {
  const { state, exportData, resetAll, sync } = useAppState()
  const profile = state.profile!
  const now = useNow(30_000)
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
  const todayLog = useMemo(() => state.log.filter((e) => dayOf(e.time) === today), [state.log, today])
  const totals = dayTotals(todayLog, now)
  const openSleep = findOpenSleep(state.log)
  const awakeMinutes = currentWakeMinutes(state.log, now)
  const lastFeed = sortedByTime(state.log.filter((e) => e.type === 'feed'))[0]
  const milkToday = totals.bottleMl

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
        {sync.paired && (
          <p className="tiny faint">
            Shared log ·{' '}
            {sync.status === 'syncing'
              ? 'syncing…'
              : sync.status === 'error'
                ? `not synced (${sync.pendingCount} waiting)`
                : sync.pendingCount > 0
                  ? `${sync.pendingCount} change${sync.pendingCount === 1 ? '' : 's'} waiting`
                  : sync.lastSyncedAt
                    ? `synced ${formatAgo(sync.lastSyncedAt, now)}`
                    : 'in sync'}
          </p>
        )}
      </header>

      <RhythmCard />

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
        <h2 className="section-title">Right now</h2>
        <p className="small" style={{ marginTop: 4 }}>
          {openSleep
            ? `Asleep since ${formatTime(openSleep.time)} — ${formatDuration(sleepMinutes(openSleep, now))} so far.`
            : awakeMinutes == null
              ? 'No sleep logged yet today.'
              : awakeMinutes < 1
                ? 'Just woke up.'
                : `Awake for ${formatDuration(awakeMinutes)}.`}
          {lastFeed ? ` Last feed ${formatAgo(lastFeed.time, now)}.` : ''}
        </p>
      </section>

      <section>
        <h2 className="section-title">Quick log</h2>
        <div style={{ marginTop: 8 }}>
          <QuickLog />
        </div>
      </section>

      <section>
        <h2 className="section-title">Today</h2>
        <div className="stat-grid" style={{ marginTop: 8 }}>
          <div className="stat-tile">
            <span className="stat-value">
              {milkToday ? `${milkToday} ml` : totals.nursingMinutes ? formatDuration(totals.nursingMinutes) : '—'}
            </span>
            <span className="stat-label">
              {milkToday && totals.nursingMinutes
                ? `Bottles · ${formatDuration(totals.nursingMinutes)} nursing`
                : milkToday
                  ? 'Milk in bottles'
                  : 'Nursing'}
            </span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{formatDuration(totals.sleepMinutes)}</span>
            <span className="stat-label">Sleep ({totals.sleeps})</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{totals.nappyTotal}</span>
            <span className="stat-label">Nappies</span>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <DayTotalsCard totals={totals} />
        </div>
        <Link to="/log" className="btn btn-ghost btn-sm" style={{ marginLeft: -12 }}>
          Full daily log →
        </Link>
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
          <hr className="rule" />
          <SharingPanel />
          <hr className="rule" />
          <button className="btn" onClick={exportData}>
            Download backup (JSON)
          </button>
          <RestoreBackup />
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
            {sync.paired
              ? 'Entries are kept on this phone and synced to your shared log. A backup is still worth having before clearing browser data.'
              : 'All data lives only in this browser. Download a backup before clearing your browser data or switching devices.'}
          </p>
        </div>
      </details>

      <p className="disclaimer">
        General information, not medical advice. Every baby develops at her own pace — talk to your
        pediatrician about anything that concerns you.
      </p>
    </main>
  )

}

function RestoreBackup() {
  const { importData } = useAppState()
  const [status, setStatus] = useState<string | null>(null)
  return (
    <div className="stack">
      <label className="btn btn-block" style={{ textAlign: 'center', cursor: 'pointer' }}>
        Restore from a backup file…
        <input
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            setStatus('Reading…')
            const result = importData(await file.text())
            setStatus(
              result
                ? `Added ${result.imported} entries. Anything already here was kept.`
                : 'That file was not a Little One backup.',
            )
          }}
        />
      </label>
      {status && <p className="tiny muted">{status}</p>}
    </div>
  )
}

function EditProfile() {
  const { state, setProfile } = useAppState()
  const profile = state.profile!
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

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Up in the night 🌙'
  if (h < 12) return 'Good morning ☀️'
  if (h < 18) return 'Good afternoon'
  return 'Good evening 🌙'
}
