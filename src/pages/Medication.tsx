import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppState } from '../hooks/useAppState'
import { useNow } from '../hooks/useNow'
import type { LogEntry, MedicationEntry } from '../lib/types'
import { uid } from '../lib/storage'
import { minutesSincePreviousDose, sortedByTime } from '../lib/log'
import { dayOf, formatAgo, formatDayLabel, formatDuration, formatTime, nowLocalDatetime } from '../lib/format'

export function Medication() {
  const { state, addLog, updateLog, deleteLog } = useAppState()
  const now = useNow(30_000)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [time, setTime] = useState(nowLocalDatetime())
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const doses = useMemo(
    () => sortedByTime(state.log.filter((e): e is MedicationEntry => e.type === 'medication')),
    [state.log],
  )

  /** Everything given before, newest first, so a repeat dose is one tap away */
  const recentNames = useMemo(() => {
    const seen: string[] = []
    for (const dose of doses) {
      if (!seen.some((n) => n.toLowerCase() === dose.name.toLowerCase())) seen.push(dose.name)
      if (seen.length === 5) break
    }
    return seen
  }, [doses])

  const days = useMemo(() => {
    const byDay = new Map<string, MedicationEntry[]>()
    for (const dose of doses) {
      const day = dayOf(dose.time)
      byDay.set(day, [...(byDay.get(day) ?? []), dose])
    }
    return [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [doses])

  function resetForm() {
    setEditingId(null)
    setTime(nowLocalDatetime())
    setName('')
    setAmount('')
    setNote('')
  }

  function startEdit(dose: MedicationEntry) {
    setEditingId(dose.id)
    setTime(toLocalInput(dose.time))
    setName(dose.name)
    setAmount(dose.amount ?? '')
    setNote(dose.note ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!time || !name.trim()) return
    const entry: LogEntry = {
      id: editingId ?? uid(),
      type: 'medication',
      time: new Date(time).toISOString(),
      name: name.trim(),
      amount: amount.trim() || undefined,
      note: note.trim() || undefined,
    }
    if (editingId) updateLog(entry)
    else addLog(entry)
    resetForm()
  }

  const lastDose = doses[0]

  return (
    <main className="page">
      <header>
        <h1 className="page-title">Medication</h1>
        <p className="page-subtitle">Every dose, with what it was, how much, and when.</p>
      </header>

      {lastDose && (
        <section className="card card-tinted">
          <p className="rhythm-label">Last dose</p>
          <p className="item-title" style={{ marginTop: 4 }}>
            {lastDose.name}
            {lastDose.amount ? ` · ${lastDose.amount}` : ''}
          </p>
          <p className="small muted">
            {formatTime(lastDose.time)} — {formatAgo(lastDose.time, now)}
          </p>
        </section>
      )}

      <form className="card stack" onSubmit={handleSubmit}>
        <h2 className="item-title">{editingId ? 'Edit dose' : 'Add a dose'}</h2>

        <div className="field">
          <label htmlFor="med-time">Time given</label>
          <input
            id="med-time"
            type="datetime-local"
            value={time}
            max={nowLocalDatetime()}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        <div className="field-row">
          <div className="field" style={{ flex: 2 }}>
            <label htmlFor="med-name">Medication</label>
            <input
              id="med-name"
              type="text"
              placeholder="Paracetamol"
              autoCapitalize="words"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="med-amount">Amount</label>
            <input
              id="med-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.7 ml"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        {recentNames.length > 0 && !editingId && (
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {recentNames.map((recent) => (
              <button
                key={recent}
                type="button"
                className="btn btn-sm"
                onClick={() => setName(recent)}
              >
                {recent}
              </button>
            ))}
          </div>
        )}

        <div className="field">
          <label htmlFor="med-note">Notes</label>
          <textarea
            id="med-note"
            rows={3}
            placeholder="e.g. for her jabs, given before a feed, prescribed by Dr Lee"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={!time || !name.trim()}>
            {editingId ? 'Save changes' : 'Add dose'}
          </button>
          {(editingId || name || amount || note) && (
            <button type="button" className="btn" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {days.length === 0 && <div className="empty">No medication logged yet.</div>}

      {days.map(([day, entries]) => (
        <section key={day}>
          <div className="day-divider">{formatDayLabel(day)}</div>
          <div className="card" style={{ marginTop: 6 }}>
            {entries.map((dose) => {
              const since = minutesSincePreviousDose(state.log, dose)
              return (
                <div className="list-item" key={dose.id}>
                  <div className="item-icon" aria-hidden="true">
                    💊
                  </div>
                  <div className="grow">
                    <div className="item-title">
                      {dose.name}
                      {dose.amount ? ` · ${dose.amount}` : ''}
                    </div>
                    <div className="item-sub">
                      {formatTime(dose.time)}
                      {since != null ? ` · ${formatDuration(since)} after the previous dose` : ''}
                    </div>
                    {dose.note && <div className="item-sub">{dose.note}</div>}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(dose)}>
                    Edit
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteLog(dose.id)}>
                    Delete
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <p className="disclaimer">
        A record of what you gave, not advice on what to give. Follow the dosing on the label or from
        your pharmacist or doctor.
      </p>
    </main>
  )
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
