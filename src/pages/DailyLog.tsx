import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppState } from '../hooks/useAppState'
import { useNow } from '../hooks/useNow'
import { QuickLog } from '../components/QuickLog'
import { DayTimeline } from '../components/DayTimeline'
import { DayTotalsCard } from '../components/DayTotalsCard'
import type {
  BottleContent,
  FeedKind,
  LogEntry,
  LogEntryType,
  NappyKind,
} from '../lib/types'
import { uid } from '../lib/storage'
import {
  BOTTLE_LABELS,
  BOTTLE_OPTIONS,
  NAPPY_LABELS,
  dayTotals,
  sortedByTime,
  summarizeEntry,
  wakeWindows,
} from '../lib/log'
import { dayOf, formatDayLabel, formatDuration, formatTime, nowLocalDatetime } from '../lib/format'

const ICONS: Record<LogEntryType, string> = { feed: '🍼', sleep: '😴', nappy: '🧷', pump: '🥛' }
const TYPE_LABELS: Record<LogEntryType, string> = {
  feed: 'Feed',
  sleep: 'Sleep',
  nappy: 'Nappy',
  pump: 'Pump',
}
const FEED_KIND_LABELS: Record<FeedKind, string> = {
  nursing: 'Nursed',
  bottle: 'Bottle',
  solids: 'Solids',
}

/** A stretch of awake time, shown between sleeps in the timeline */
interface WakeRow {
  kind: 'wake'
  id: string
  time: string
  minutes: number
  open: boolean
}
type TimelineRow = { kind: 'entry'; id: string; time: string; entry: LogEntry } | WakeRow

export function DailyLog() {
  const { state, addLog, updateLog, deleteLog } = useAppState()
  const now = useNow(30_000)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [type, setType] = useState<LogEntryType>('feed')
  const [time, setTime] = useState(nowLocalDatetime())
  const [feedKind, setFeedKind] = useState<FeedKind>('nursing')
  const [leftMinutes, setLeftMinutes] = useState('')
  const [rightMinutes, setRightMinutes] = useState('')
  const [contents, setContents] = useState<BottleContent>('formula')
  const [amount, setAmount] = useState('')
  const [endTime, setEndTime] = useState('')
  const [nappyKind, setNappyKind] = useState<NappyKind>('wet')
  const [pumpLeft, setPumpLeft] = useState('')
  const [pumpRight, setPumpRight] = useState('')
  const [pumpMinutes, setPumpMinutes] = useState('')
  const [note, setNote] = useState('')

  const days = useMemo(() => {
    const byDay = new Map<string, LogEntry[]>()
    for (const entry of state.log) {
      const day = dayOf(entry.time)
      const list = byDay.get(day) ?? []
      list.push(entry)
      byDay.set(day, list)
    }
    // Wake windows span sleeps, so they are worked out across the whole log and
    // then filed under the day the baby woke up.
    const windowsByDay = new Map<string, WakeRow[]>()
    for (const w of wakeWindows(state.log, now)) {
      if (w.minutes < 1) continue
      const day = dayOf(w.start)
      const list = windowsByDay.get(day) ?? []
      list.push({ kind: 'wake', id: `wake-${w.start}`, time: w.start, minutes: w.minutes, open: w.open })
      windowsByDay.set(day, list)
    }

    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, entries]) => {
        const rows: TimelineRow[] = [
          ...entries.map((entry) => ({ kind: 'entry' as const, id: entry.id, time: entry.time, entry })),
          ...(windowsByDay.get(day) ?? []),
        ]
        return { day, entries, rows: sortedByTime(rows) }
      })
  }, [state.log, now])

  function resetForm() {
    setFormOpen(false)
    setEditingId(null)
    setType('feed')
    setTime(nowLocalDatetime())
    setFeedKind('nursing')
    setLeftMinutes('')
    setRightMinutes('')
    setContents('formula')
    setAmount('')
    setEndTime('')
    setNappyKind('wet')
    setPumpLeft('')
    setPumpRight('')
    setPumpMinutes('')
    setNote('')
  }

  function startEdit(entry: LogEntry) {
    resetForm()
    setFormOpen(true)
    setEditingId(entry.id)
    setType(entry.type)
    setTime(toLocalInput(entry.time))
    setNote(entry.note ?? '')
    if (entry.type === 'feed') {
      setFeedKind(entry.kind)
      setLeftMinutes(entry.leftMinutes?.toString() ?? '')
      setRightMinutes(entry.rightMinutes?.toString() ?? '')
      setContents(entry.contents ?? 'formula')
      setAmount(entry.amountMl?.toString() ?? '')
    } else if (entry.type === 'sleep') {
      setEndTime(entry.endTime ? toLocalInput(entry.endTime) : '')
    } else if (entry.type === 'nappy') {
      setNappyKind(entry.kind)
    } else {
      setPumpLeft(entry.leftMl?.toString() ?? '')
      setPumpRight(entry.rightMl?.toString() ?? '')
      setPumpMinutes(entry.durationMinutes?.toString() ?? '')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!time) return
    const iso = new Date(time).toISOString()
    const id = editingId ?? uid()
    const trimmedNote = note.trim() || undefined
    const existing = editingId ? state.log.find((entry) => entry.id === editingId) : undefined

    let entry: LogEntry
    if (type === 'feed') {
      entry = {
        id,
        type: 'feed',
        time: iso,
        kind: feedKind,
        leftMinutes: feedKind === 'nursing' ? num(leftMinutes) : undefined,
        rightMinutes: feedKind === 'nursing' ? num(rightMinutes) : undefined,
        // keep a running timer alive when its session is edited
        activeSide: existing?.type === 'feed' ? existing.activeSide : undefined,
        sideStartedAt: existing?.type === 'feed' ? existing.sideStartedAt : undefined,
        contents: feedKind === 'bottle' ? contents : undefined,
        amountMl: feedKind === 'bottle' ? num(amount) : undefined,
        note: trimmedNote,
      }
    } else if (type === 'sleep') {
      entry = {
        id,
        type: 'sleep',
        time: iso,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        note: trimmedNote,
      }
    } else if (type === 'nappy') {
      entry = { id, type: 'nappy', time: iso, kind: nappyKind, note: trimmedNote }
    } else {
      entry = {
        id,
        type: 'pump',
        time: iso,
        leftMl: num(pumpLeft),
        rightMl: num(pumpRight),
        durationMinutes: num(pumpMinutes),
        note: trimmedNote,
      }
    }
    if (editingId) updateLog(entry)
    else addLog(entry)
    resetForm()
  }

  return (
    <main className="page">
      <header>
        <h1 className="page-title">Daily log</h1>
        <p className="page-subtitle">
          Milk, nappies, sleep and pumping — tap it in as it happens, or add it later.
        </p>
      </header>

      <QuickLog />

      {!formOpen ? (
        <button className="btn btn-block" onClick={() => setFormOpen(true)}>
          + Add with details
        </button>
      ) : (
        <form className="card stack" onSubmit={handleSubmit}>
          <h2 className="item-title">{editingId ? 'Edit entry' : 'New entry'}</h2>
          <div className="seg" role="group" aria-label="Entry type">
            {(Object.keys(TYPE_LABELS) as LogEntryType[]).map((t) => (
              <button key={t} type="button" className={type === t ? 'on' : ''} onClick={() => setType(t)}>
                {ICONS[t]} {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="field">
            <label htmlFor="log-time">
              {type === 'sleep' ? 'Fell asleep' : type === 'feed' ? 'Feed started' : 'Time'}
            </label>
            <input
              id="log-time"
              type="datetime-local"
              value={time}
              max={nowLocalDatetime()}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          {type === 'feed' && (
            <>
              <div className="seg" role="group" aria-label="Feed type">
                {(Object.keys(FEED_KIND_LABELS) as FeedKind[]).map((k) => (
                  <button key={k} type="button" className={feedKind === k ? 'on' : ''} onClick={() => setFeedKind(k)}>
                    {FEED_KIND_LABELS[k]}
                  </button>
                ))}
              </div>

              {feedKind === 'nursing' && (
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="log-left">Left (minutes)</label>
                    <input
                      id="log-left"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      placeholder="15"
                      value={leftMinutes}
                      onChange={(e) => setLeftMinutes(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="log-right">Right (minutes)</label>
                    <input
                      id="log-right"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      placeholder="10"
                      value={rightMinutes}
                      onChange={(e) => setRightMinutes(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {feedKind === 'bottle' && (
                <div className="stack">
                  <div className="seg" role="group" aria-label="What's in the bottle">
                    {BOTTLE_OPTIONS.map((c) => (
                      <button key={c} type="button" className={contents === c ? 'on' : ''} onClick={() => setContents(c)}>
                        {BOTTLE_LABELS[c]}
                      </button>
                    ))}
                  </div>
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
                </div>
              )}
            </>
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

          {type === 'nappy' && (
            <div className="seg" role="group" aria-label="Nappy kind">
              {(Object.keys(NAPPY_LABELS) as NappyKind[]).map((k) => (
                <button key={k} type="button" className={nappyKind === k ? 'on' : ''} onClick={() => setNappyKind(k)}>
                  {NAPPY_LABELS[k]}
                </button>
              ))}
            </div>
          )}

          {type === 'pump' && (
            <div className="field-row">
              <div className="field">
                <label htmlFor="log-pump-left">Left (ml)</label>
                <input
                  id="log-pump-left"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="5"
                  placeholder="60"
                  value={pumpLeft}
                  onChange={(e) => setPumpLeft(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="log-pump-right">Right (ml)</label>
                <input
                  id="log-pump-right"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="5"
                  placeholder="60"
                  value={pumpRight}
                  onChange={(e) => setPumpRight(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="log-pump-mins">Minutes</label>
                <input
                  id="log-pump-mins"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="20"
                  value={pumpMinutes}
                  onChange={(e) => setPumpMinutes(e.target.value)}
                />
              </div>
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

      {days.length === 0 && (
        <div className="empty">Nothing logged yet — the buttons above make it a one-tap job.</div>
      )}

      {days.map(({ day, entries, rows }) => (
        <section key={day} className="stack">
          <div className="day-divider">{formatDayLabel(day)}</div>
          <DayTimeline day={day} entries={entries} now={now} />
          <DayTotalsCard totals={dayTotals(entries, now)} />
          <div className="card">
            {rows.map((row) =>
              row.kind === 'wake' ? (
                <div className="wake-row" key={row.id}>
                  <span aria-hidden="true">☀️</span> Awake {formatDuration(row.minutes)}
                  {row.open ? ' so far' : ''} · from {formatTime(row.time)}
                </div>
              ) : (
                <LogRow
                  key={row.id}
                  entry={row.entry}
                  now={now}
                  onEdit={() => startEdit(row.entry)}
                  onDelete={() => deleteLog(row.entry.id)}
                />
              ),
            )}
          </div>
        </section>
      ))}
    </main>
  )
}

function LogRow({
  entry,
  now,
  onEdit,
  onDelete,
}: {
  entry: LogEntry
  now: Date
  onEdit: () => void
  onDelete: () => void
}) {
  const { title, detail } = summarizeEntry(entry, now)
  return (
    <div className="list-item">
      <div className="item-icon" aria-hidden="true">
        {ICONS[entry.type]}
      </div>
      <div className="grow">
        <div className="item-title">{title}</div>
        <div className="item-sub">
          {[formatTime(entry.time), detail, entry.note].filter(Boolean).join(' · ')}
        </div>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onEdit}>
        Edit
      </button>
      <button className="btn btn-danger btn-sm" onClick={onDelete}>
        Delete
      </button>
    </div>
  )
}

function num(value: string): number | undefined {
  const n = Number(value)
  return value.trim() && Number.isFinite(n) && n > 0 ? n : undefined
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
