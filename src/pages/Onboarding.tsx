import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAppState } from '../hooks/useAppState'
import type { Sex } from '../lib/types'
import { todayISO } from '../lib/format'

export function Onboarding() {
  const { setProfile } = useAppState()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState<Sex>('female')
  const [dueDate, setDueDate] = useState('')

  const canSave = name.trim().length > 0 && birthDate.length > 0 && birthDate <= todayISO()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setProfile({
      name: name.trim(),
      birthDate,
      sex,
      dueDate: dueDate || undefined,
    })
  }

  return (
    <main className="page" style={{ paddingTop: 48 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }} aria-hidden="true">
          👣
        </div>
        <h1 className="page-title">Welcome to Little One</h1>
        <p className="page-subtitle" style={{ marginTop: 6 }}>
          A private tracker for your baby's milestones, growth, daily rhythms and firsts.
          Everything stays on this device.
        </p>
      </div>

      <form className="card stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="ob-name">Baby's name</label>
          <input
            id="ob-name"
            type="text"
            placeholder="e.g. Amelia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="ob-birth">Date of birth</label>
          <input
            id="ob-birth"
            type="date"
            max={todayISO()}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label id="ob-sex-label">Sex (used for growth charts)</label>
          <div className="seg" role="group" aria-labelledby="ob-sex-label">
            <button type="button" className={sex === 'female' ? 'on' : ''} onClick={() => setSex('female')}>
              Girl
            </button>
            <button type="button" className={sex === 'male' ? 'on' : ''} onClick={() => setSex('male')}>
              Boy
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="ob-due">Due date (optional)</label>
          <input id="ob-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <span className="tiny faint">
            If she arrived early, this lets the app show her adjusted age for milestones.
          </span>
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={!canSave}>
          Start tracking
        </button>
      </form>

      <p className="disclaimer">
        Little One offers general information about how babies typically develop. It is not medical
        advice — always talk to your pediatrician about anything that concerns you.
      </p>
    </main>
  )
}
