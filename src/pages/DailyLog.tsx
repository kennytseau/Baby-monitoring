import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppState } from '../hooks/useAppState'
import type { DiaperKind, FeedEntry, FeedMethod, LogEntry, SleepEntry } from '../lib/types'
import { uid } from '../lib/storage'
import { dayOf, formatDayLabel, formatDuration, formatTime, nowLocalDatetime } from '../lib/format'

const FEED_LABELS: Record<FeedMethod, string> = {
  'breast-left': 'Breast (left)',
  'breast-right': 'Breast (right)',
  bottle: 'Bottle',
  solids: 'Solids',
}
const DIAPER_LABELS: Record<DiaperKind, string> = { wet: 'Wet', dirty: 'Dirty', both: 'Wet + dirty' }
const ICONS = { feed: '🍼', sleep: '😴', diaper: '🧷' } as const

type EntryType = LogEntry['type']

export function DailyLog() {
  const { state, addLog, updateLog, deleteLog } = useAppState()
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [type, setType] = useState<EntryType>('feed')
  const [time, setTime] = useState(nowLocalDatetime())
  const [method, setMethod] = useState<FeedMethod>('breast-left')
  const [amount, setAmount] = useState('')
  const [endTime, setEndTime] = useState('')
  const [kind, setKind] = useState<DiaperKind>('wet')
  const [note, setNote] = useState('')

  const openSleep = state.log.find((e): e is SleepEntry => e.type === 'sleep' && !e.endTime)

  const days = useMemo(() => {
    const byDay = new Map<string, LogEntry[]>()
    for (const entry of state.log) {
      const day = dayOf(entry.time)
      const list = byDay.get(day) ?? []
      list.push(entry)
      byDay.set(day, list)
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, entries]) => ({
        day,
        entries: entries.sort((a, b) => b.time.localeCompare(a.time)),
      }))
  }, [state.log])

  function quickFeed() {
    const lastFeed = [...state.log].reverse().find((e): e is FeedEntry => e.type === 'feed')
    addLog({ id: uid(), type: 'feed', time: new Date().toISOString(), method: lastFeed?.method ?? 'breast-left' })
  }
  function quickSleep() {
    if (openSleep) updateLog({ ...openSleep, endTime: new Date().toISOString() })
    else addLog({ id: uid(), type: 'sleep', time: new Date().toISOString() })
  }
  function quickDiaper() {
    addLog({ id: uid(), type: 'diaper', time: new Date().toISOString(), kind: 'wet' })
  }

  function resetForm() {
    setFormOpen(false)
    setEditingId(null)
    setType('feed')
    setTime(nowLocalDatetime())
    setMethod('breast-left')
    setAmount('')
    setEndTime('')
    setKind('wet')
    setNote('')
  }

  function startEdit(entry: LogEntry) {
    setFormOpen(true)
    setEditingId(entry.id)
    setType(entry.type)
    setTime(toLocalInput(entry.time))
    setNote(entry.note ?? '')
    if (entry.type === 'feed') {
      setMethod(entry.method)
      setAmount(entry.amountMl?.toString() ?? '')
    } else if (entry.type === 'sleep') {
      setEndTime(entry.endTime ? toLocalInput(entry.endTime) : '')
    } else {
      setKind(entry.kind)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!time) return
    const iso = new Date(time).toISOString()
    const id = editingId ?? uid()
    const trimmedNote = note.trim() || undefined
    let entry: LogEntry
    if (type === 'feed') {
      const ml = Number(amount)
      entry = {
        id,
        type,
        time: iso,
        method,
        amountMl: amount.trim() && Number.isFinite(ml) && ml > 0 ? ml : undefined,
        note: trimmedNote,
      }
    } else if (type === 'sleep') {
      entry = {
        id,
        type,
        time: iso,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        note: trimmedNote,
      }
    } else {
      entry = { id, type, time: iso, kind, note: trimmedNote }
    }
    if (editingId) updateLog(entry)
    else addLog(entry)
    resetForm()
  }

  return (
    <main className="page">
      <header>
        <h1 className="page-title">Daily log</h1>
        <p className="page-subtitle">Feeds, sleep and diapers — tap to log it as it happens.</p>
      </header>

      <div className="quick-btns">
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

      {!formOpen ? (
        <button className="btn btn-block" onClick={() => setFormOpen(true)}>
          + Add with details
        </button>
      ) : (
        <form className="card stack" onSubmit={handleSubmit}>
          <h2 className="item-title">{editingId ? 'Edit entry' : 'New entry'}</h2>
          <div className="seg" role="group" aria-label="Entry type">
            {(['feed', 'sleep', 'diaper'] as const).map((t) => (
              <button key={t} type="button" className={type === t ? 'on' : ''} onClick={() => setType(t)}>
                {ICONS[t]} {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="field">
            <label htmlFor="log-time">{type === 'sleep' ? 'Fell asleep' : 'Time'}</label>
            <input
              id="log-time"
              type="datetime-local"
              value={time}
              max={nowLocalDatetime()}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          {type === 'feed' && (
            <div className="field-row">
              <div className="field">
                <label htmlFor="log-method">Method</label>
                <select id="log-method" value={method} onChange={(e) => setMethod(e.target.value as FeedMethod)}>
                  {Object.entries(FEED_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {method === 'bottle' && (
                <div className="field">
                  <label htmlFor="log-amount">Amount (ml)</label>
                  <input
                    id="log-amount"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="5"
                    placeholder="90"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {type === 'sleep' && (
            <div className="field">
              <label htmlFor="log-end">Woke up (leave empty if still sleeping)</label>
              <input
                id="log-end"
                type="datetime-local"
                value={endTime}
                min={time}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          )}

          {type === 'diaper' && (
            <div className="seg" role="group" aria-label="Diaper kind">
              {(Object.keys(DIAPER_LABELS) as DiaperKind[]).map((k) => (
                <button key={k} type="button" className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
                  {DIAPER_LABELS[k]}
                </button>
              ))}
            </div>
          )}

          <div className="field">
            <label htmlFor="log-note">Note (optional)</label>
            <input
              id="log-note"
              type="text"
              placeholder="e.g. fussy before feed"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={!time}>
              {editingId ? 'Save changes' : 'Add entry'}
            </button>
            <button type="button" className="btn" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {days.length === 0 && <div className="empty">Nothing logged yet — the buttons above make it a one-tap job.</div>}

      {days.map(({ day, entries }) => (
        <section key={day}>
          <div className="row-between day-divider">
            <span>{formatDayLabel(day)}</span>
            <span style={{ textTransform: 'none', letterSpacing: 0 }}>{daySummary(entries)}</span>
          </div>
          <div className="card" style={{ marginTop: 6 }}>
            {entries.map((entry) => (
              <div className="list-item" key={entry.id}>
                <div className="item-icon" aria-hidden="true">
                  {ICONS[entry.type]}
                </div>
                <div className="grow">
                  <div className="item-title">{describe(entry)}</div>
                  <div className="item-sub">
                    {formatTime(entry.time)}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(entry)}>
                  Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteLog(entry.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}

function describe(entry: LogEntry): string {
  if (entry.type === 'feed') {
    return entry.amountMl ? `${FEED_LABELS[entry.method]} · ${entry.amountMl} ml` : FEED_LABELS[entry.method]
  }
  if (entry.type === 'sleep') {
    if (!entry.endTime) return `Sleeping since ${formatTime(entry.time)}`
    const mins = (new Date(entry.endTime).getTime() - new Date(entry.time).getTime()) / 60000
    return `Sleep · ${formatTime(entry.time)}–${formatTime(entry.endTime)} (${formatDuration(mins)})`
  }
  return `Diaper · ${DIAPER_LABELS[entry.kind]}`
}

function daySummary(entries: LogEntry[]): string {
  const feeds = entries.filter((e) => e.type === 'feed').length
  const diapers = entries.filter((e) => e.type === 'diaper').length
  const sleepMins = entries
    .filter((e): e is SleepEntry => e.type === 'sleep' && !!e.endTime)
    .reduce((t, e) => t + (new Date(e.endTime!).getTime() - new Date(e.time).getTime()) / 60000, 0)
  const parts: string[] = []
  if (feeds) parts.push(`${feeds} feeds`)
  if (sleepMins) parts.push(formatDuration(sleepMins))
  if (diapers) parts.push(`${diapers} diapers`)
  return parts.join(' · ')
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
