import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppState } from '../hooks/useAppState'
import { DevelopmentCard } from '../components/DevelopmentCard'
import { GrowthChart } from '../components/GrowthChart'
import type { ChartPoint } from '../components/GrowthChart'
import { GROWTH_CURVES, MEASURE_INFO } from '../data/who-growth'
import type { Measure } from '../data/who-growth'
import { estimatePercentile, ordinal } from '../lib/percentiles'
import { ageInMonthsFloat, parseISODate } from '../lib/age'
import { formatDate, todayISO } from '../lib/format'
import type { GrowthEntry } from '../lib/types'
import { uid } from '../lib/storage'

const MEASURES: Measure[] = ['weight', 'length', 'head']

export function Growth() {
  const { state, addGrowth, updateGrowth, deleteGrowth } = useAppState()
  const profile = state.profile!
  const [measure, setMeasure] = useState<Measure>('weight')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [date, setDate] = useState(todayISO())
  const [weight, setWeight] = useState('')
  const [length, setLength] = useState('')
  const [head, setHead] = useState('')

  const rows = GROWTH_CURVES[profile.sex][measure]
  const info = MEASURE_INFO[measure]
  const currentAgeMonths = ageInMonthsFloat(profile.birthDate)

  const sorted = useMemo(
    () => [...state.growth].sort((a, b) => a.date.localeCompare(b.date)),
    [state.growth],
  )

  /**
   * The most recent reading of each measurement with the percentile it sits at.
   * This used to be a weight-only line on Home; it belongs here, where the
   * charts behind it are one tap away.
   */
  const latest = useMemo(
    () =>
      MEASURES.map((m) => {
        const measureInfo = MEASURE_INFO[m]
        const entry = [...sorted].reverse().find((e) => e[measureInfo.field] != null)
        if (!entry) return null
        const value = entry[measureInfo.field]!
        const ageMonths = ageInMonthsFloat(profile.birthDate, parseISODate(entry.date))
        return {
          measure: m,
          label: measureInfo.shortLabel,
          text: `${value} ${measureInfo.unit}`,
          date: entry.date,
          percentile: estimatePercentile(GROWTH_CURVES[profile.sex][m], ageMonths, value),
        }
      }).filter((x): x is NonNullable<typeof x> => x !== null),
    [sorted, profile.sex, profile.birthDate],
  )

  const points: ChartPoint[] = useMemo(
    () =>
      sorted
        .filter((e) => e[info.field] != null)
        .map((e) => ({
          date: e.date,
          ageMonths: ageInMonthsFloat(profile.birthDate, parseISODate(e.date)),
          value: e[info.field]!,
        })),
    [sorted, info.field, profile.birthDate],
  )

  function resetForm() {
    setEditingId(null)
    setDate(todayISO())
    setWeight('')
    setLength('')
    setHead('')
  }

  function startEdit(entry: GrowthEntry) {
    setEditingId(entry.id)
    setDate(entry.date)
    setWeight(entry.weightKg?.toString() ?? '')
    setLength(entry.lengthCm?.toString() ?? '')
    setHead(entry.headCm?.toString() ?? '')
  }

  const parsed = {
    weightKg: parseNum(weight),
    lengthCm: parseNum(length),
    headCm: parseNum(head),
  }
  const canSave =
    date.length > 0 &&
    date <= todayISO() &&
    date >= profile.birthDate &&
    (parsed.weightKg != null || parsed.lengthCm != null || parsed.headCm != null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    const entry: GrowthEntry = { id: editingId ?? uid(), date, ...parsed }
    if (editingId) updateGrowth(entry)
    else addGrowth(entry)
    resetForm()
  }

  return (
    <main className="page">
      <header>
        <h1 className="page-title">Growth</h1>
        <p className="page-subtitle">
          {profile.name}'s measurements against reference percentile curves (
          {profile.sex === 'female' ? 'girls' : 'boys'}, 0–24 months).
        </p>
      </header>

      <DevelopmentCard />

      <div className="seg" role="group" aria-label="Measurement type">
        {MEASURES.map((m) => (
          <button key={m} className={measure === m ? 'on' : ''} onClick={() => setMeasure(m)}>
            {MEASURE_INFO[m].shortLabel}
          </button>
        ))}
      </div>

      <section className="card">
        <div className="row-between">
          <h2 className="item-title">{info.label}</h2>
          <span className="tiny muted">{info.unit}</span>
        </div>
        <GrowthChart rows={rows} points={points} unit={info.unit} currentAgeMonths={currentAgeMonths} />
        <p className="tiny faint">
          Shaded areas show where most babies fall: dark band 15th–85th, light band 3rd–97th
          percentile. Curves approximate the WHO Child Growth Standards.
        </p>
      </section>

      <form className="card stack" onSubmit={handleSubmit}>
        <h2 className="item-title">{editingId ? 'Edit measurement' : 'Add a measurement'}</h2>
        <div className="field-row">
          <div className="field">
            <label htmlFor="g-date">Date</label>
            <input
              id="g-date"
              type="date"
              value={date}
              min={profile.birthDate}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="g-weight">Weight (kg)</label>
            <input
              id="g-weight"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="4.20"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="g-length">Length (cm)</label>
            <input
              id="g-length"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              placeholder="54.5"
              value={length}
              onChange={(e) => setLength(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="g-head">Head (cm)</label>
            <input
              id="g-head"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              placeholder="37.0"
              value={head}
              onChange={(e) => setHead(e.target.value)}
            />
          </div>
        </div>
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={!canSave}>
            {editingId ? 'Save changes' : 'Add measurement'}
          </button>
          {editingId && (
            <button type="button" className="btn" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {sorted.length > 0 && (
        <section className="card">
          <h2 className="item-title">History</h2>
          {[...sorted].reverse().map((entry) => (
            <div className="list-item" key={entry.id}>
              <div className="grow">
                <div className="item-title">{formatDate(entry.date)}</div>
                <div className="item-sub">{describeEntry(entry, profile.sex, profile.birthDate)}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => startEdit(entry)}>
                Edit
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => deleteGrowth(entry.id)}>
                Delete
              </button>
            </div>
          ))}
        </section>
      )}

      {latest.length > 0 && (
        <section className="card growth-latest">
          <p className="rhythm-label">Latest</p>
          {latest.map((item) => (
            <button
              key={item.measure}
              className="growth-latest-row"
              onClick={() => setMeasure(item.measure)}
            >
              <span className="growth-latest-key">{item.label}</span>
              <span className="growth-latest-value">{item.text}</span>
              <span className="tiny muted">
                {ordinal(item.percentile)} percentile · {formatDate(item.date)}
              </span>
            </button>
          ))}
        </section>
      )}

      <p className="disclaimer">
        Percentiles here are approximate and for interest only — your pediatrician's measurements
        and charts are the reference that counts.
      </p>
    </main>
  )
}

function parseNum(s: string): number | undefined {
  if (!s.trim()) return undefined
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function describeEntry(entry: GrowthEntry, sex: 'female' | 'male', birthDate: string): string {
  const at = ageInMonthsFloat(birthDate, parseISODate(entry.date))
  const parts: string[] = []
  for (const measure of MEASURES) {
    const info = MEASURE_INFO[measure]
    const value = entry[info.field]
    if (value != null) {
      const pct = estimatePercentile(GROWTH_CURVES[sex][measure], at, value)
      parts.push(`${info.shortLabel.toLowerCase()} ${value} ${info.unit} (~${ordinal(pct)})`)
    }
  }
  return parts.join(' · ')
}
