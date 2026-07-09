import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppState } from '../hooks/useAppState'
import { formatAge, parseISODate } from '../lib/age'
import { formatDate, todayISO } from '../lib/format'
import type { Memory } from '../lib/types'
import { uid } from '../lib/storage'

const SUGGESTED_TAGS = [
  'First smile',
  'First laugh',
  'First roll',
  'First tooth',
  'First word',
  'First steps',
  'First food',
  'First outing',
]

export function Memories() {
  const { state, addMemory, updateMemory, deleteMemory } = useAppState()
  const profile = state.profile!
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayISO())
  const [tag, setTag] = useState('')
  const [note, setNote] = useState('')

  const sorted = useMemo(
    () => [...state.memories].sort((a, b) => b.date.localeCompare(a.date)),
    [state.memories],
  )

  const canSave = title.trim().length > 0 && date >= profile.birthDate && date <= todayISO()

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setDate(todayISO())
    setTag('')
    setNote('')
  }

  function startEdit(memory: Memory) {
    setEditingId(memory.id)
    setTitle(memory.title)
    setDate(memory.date)
    setTag(memory.tag ?? '')
    setNote(memory.note ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    const memory: Memory = {
      id: editingId ?? uid(),
      title: title.trim(),
      date,
      tag: tag.trim() || undefined,
      note: note.trim() || undefined,
    }
    if (editingId) updateMemory(memory)
    else addMemory(memory)
    resetForm()
  }

  return (
    <main className="page">
      <header>
        <h1 className="page-title">Memories</h1>
        <p className="page-subtitle">The firsts and little moments you'll want to remember.</p>
      </header>

      <form className="card stack" onSubmit={handleSubmit}>
        <h2 className="item-title">{editingId ? 'Edit memory' : 'New memory'}</h2>
        <div className="field">
          <label htmlFor="mem-title">What happened?</label>
          <input
            id="mem-title"
            type="text"
            placeholder="e.g. Smiled at Dada for the first time"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="mem-date">Date</label>
            <input
              id="mem-date"
              type="date"
              value={date}
              min={profile.birthDate}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="mem-tag">Tag (optional)</label>
            <input
              id="mem-tag"
              type="text"
              list="mem-tags"
              placeholder="First smile"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />
            <datalist id="mem-tags">
              {SUGGESTED_TAGS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="field">
          <label htmlFor="mem-note">The story (optional)</label>
          <textarea
            id="mem-note"
            rows={3}
            placeholder="Who was there, what it was like…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={!canSave}>
            {editingId ? 'Save changes' : 'Save memory'}
          </button>
          {editingId && (
            <button type="button" className="btn" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {sorted.length === 0 && (
        <div className="empty">
          No memories yet. First smile, first giggle, first walk in the park — capture them here
          while they're fresh.
        </div>
      )}

      {sorted.map((memory) => (
        <article className="card" key={memory.id}>
          <div className="row-between">
            <h2 className="item-title">{memory.title}</h2>
            {memory.tag && <span className="chip chip-neutral">{memory.tag}</span>}
          </div>
          <p className="item-sub" style={{ marginTop: 4 }}>
            {formatDate(memory.date)} · {formatAge(profile.birthDate, parseISODate(memory.date))}
          </p>
          {memory.note && (
            <p className="small" style={{ marginTop: 8 }}>
              {memory.note}
            </p>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(memory)}>
              Edit
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => deleteMemory(memory.id)}>
              Delete
            </button>
          </div>
        </article>
      ))}
    </main>
  )
}
