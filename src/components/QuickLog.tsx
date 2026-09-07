import { useMemo, useState } from 'react'
import { useNow } from '../hooks/useNow'
import { useAppState } from '../hooks/useAppState'
import { useQuickLog } from '../hooks/useQuickLog'
import { NursingTimer } from './NursingTimer'
import { BOTTLE_LABELS, BOTTLE_OPTIONS, NAPPY_LABELS, sleepMinutes, sortedByTime } from '../lib/log'
import { dateFromTimeInput, formatAgo, formatDuration, formatTime, toTimeInput } from '../lib/format'
import type { BottleContent, MedicationEntry, NappyKind } from '../lib/types'

type Panel = 'nurse' | 'bottle' | 'nappy' | 'sleep' | 'medicine' | 'pump' | null

/**
 * The logging surface used on Home and in the Daily log: one tap opens a small
 * panel, a second tap records the entry with the time it happened.
 */
export function QuickLog() {
  const {
    openSleep,
    runningNursing,
    nurse,
    logNursingMinutes,
    startSleep,
    endSleep,
    logNappy,
    logBottle,
    logMedication,
    logPump,
  } = useQuickLog()
  const { state } = useAppState()
  const now = useNow(30_000)
  const [panel, setPanel] = useState<Panel>(null)

  const [contents, setContents] = useState<BottleContent>('formula')
  const [amount, setAmount] = useState('')
  const [leftMinutes, setLeftMinutes] = useState('')
  const [rightMinutes, setRightMinutes] = useState('')
  const [leftMl, setLeftMl] = useState('')
  const [rightMl, setRightMl] = useState('')
  const [pumpMinutes, setPumpMinutes] = useState('')
  const [sleepTime, setSleepTime] = useState('')
  const [sleepError, setSleepError] = useState<string | null>(null)
  const [medicineName, setMedicineName] = useState('')
  const [medicineAmount, setMedicineAmount] = useState('')
  const [medicineNote, setMedicineNote] = useState('')

  const doses = useMemo(
    () => sortedByTime(state.log.filter((e): e is MedicationEntry => e.type === 'medication')),
    [state.log],
  )
  /** The last few medicines given, with the dose that went with them, so a repeat is one tap */
  const recentMedicines = useMemo(() => {
    const seen: MedicationEntry[] = []
    for (const dose of doses) {
      if (!seen.some((d) => d.name.toLowerCase() === dose.name.toLowerCase())) seen.push(dose)
      if (seen.length === 4) break
    }
    return seen
  }, [doses])
  /** When this medicine was last given, which is what you want before giving it again */
  const previousDose = useMemo(() => {
    const name = medicineName.trim().toLowerCase()
    if (!name) return undefined
    return doses.find((d) => d.name.trim().toLowerCase() === name)
  }, [doses, medicineName])

  function toggle(next: Exclude<Panel, null>) {
    setPanel((p) => {
      if (p === next) return null
      if (next === 'sleep') {
        setSleepTime(toTimeInput(new Date()))
        setSleepError(null)
      }
      return next
    })
  }

  /** Log a nursing session from typed minutes, for when the timer was not started */
  function saveNursingMinutes() {
    const left = positiveNumber(leftMinutes)
    const right = positiveNumber(rightMinutes)
    if (!left && !right) return
    logNursingMinutes(left, right)
    setLeftMinutes('')
    setRightMinutes('')
    setPanel(null)
  }

  /** Record going down / waking, either now or at a time typed in */
  function saveSleep(at: Date) {
    if (openSleep) {
      if (at.getTime() <= new Date(openSleep.time).getTime()) {
        setSleepError(`She went down at ${formatTime(openSleep.time)} — waking must be after that.`)
        return
      }
      endSleep(at)
    } else {
      startSleep(at)
    }
    setSleepError(null)
    setPanel(null)
  }

  function saveSleepAtTypedTime() {
    const at = dateFromTimeInput(sleepTime, new Date())
    if (!at) {
      setSleepError('That is not a time — use 24-hour form, like 19:45.')
      return
    }
    saveSleep(at)
  }

  function saveBottle() {
    logBottle(contents, positiveNumber(amount))
    setAmount('')
    setPanel(null)
  }

  function saveMedicine() {
    if (!medicineName.trim()) return
    logMedication(medicineName, medicineAmount, medicineNote)
    setMedicineName('')
    setMedicineAmount('')
    setMedicineNote('')
    setPanel(null)
  }

  function savePump() {
    if (!positiveNumber(leftMl) && !positiveNumber(rightMl)) return
    logPump(positiveNumber(leftMl), positiveNumber(rightMl), positiveNumber(pumpMinutes))
    setLeftMl('')
    setRightMl('')
    setPumpMinutes('')
    setPanel(null)
  }

  return (
    <div className="stack">
      <NursingTimer />

      <div className="quick-btns quick-btns-6">
        <button
          className={`quick-btn${runningNursing ? ' quick-btn-on' : ''}`}
          onClick={() => toggle('nurse')}
          aria-expanded={panel === 'nurse'}
        >
          <span aria-hidden="true">🤱</span> Nurse
        </button>
        <button className="quick-btn" onClick={() => toggle('bottle')} aria-expanded={panel === 'bottle'}>
          <span aria-hidden="true">🍼</span> Bottle
        </button>
        <button className="quick-btn" onClick={() => toggle('nappy')} aria-expanded={panel === 'nappy'}>
          <span aria-hidden="true">🧷</span> Nappy
        </button>
        <button
          className={`quick-btn${openSleep ? ' quick-btn-on' : ''}`}
          onClick={() => toggle('sleep')}
          aria-expanded={panel === 'sleep'}
        >
          <span aria-hidden="true">{openSleep ? '☀️' : '😴'}</span>
          {openSleep ? 'Woke up' : 'Sleep'}
        </button>
        <button className="quick-btn" onClick={() => toggle('pump')} aria-expanded={panel === 'pump'}>
          <span aria-hidden="true">🥛</span> Pump
        </button>
        <button
          className="quick-btn"
          onClick={() => toggle('medicine')}
          aria-expanded={panel === 'medicine'}
        >
          <span aria-hidden="true">💊</span> Medicine
        </button>
      </div>

      {openSleep && (
        <p className="tiny muted" role="status">
          Asleep since {formatTime(openSleep.time)}
          {sleepMinutes(openSleep, now) >= 1 ? ` (${formatDuration(sleepMinutes(openSleep, now))})` : ''} — tap
          “Woke up” when she stirs.
        </p>
      )}

      {panel === 'nurse' && (
        <div className="card stack quick-panel">
          <p className="tiny muted">
            {runningNursing ? 'Switch sides — the timer keeps running.' : 'Which side is she on?'}
          </p>
          <div className="row">
            <button
              className="btn btn-primary grow"
              onClick={() => {
                nurse('left')
                setPanel(null)
              }}
            >
              Left
            </button>
            <button
              className="btn btn-primary grow"
              onClick={() => {
                nurse('right')
                setPanel(null)
              }}
            >
              Right
            </button>
          </div>

          {!runningNursing && (
            <>
              <hr className="rule" />
              <p className="tiny muted">Forgot to start the timer? Put the minutes in here.</p>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="quick-left-min">Left (minutes)</label>
                  <input
                    id="quick-left-min"
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
                  <label htmlFor="quick-right-min">Right (minutes)</label>
                  <input
                    id="quick-right-min"
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
              <button
                className="btn btn-primary btn-block"
                onClick={saveNursingMinutes}
                disabled={!positiveNumber(leftMinutes) && !positiveNumber(rightMinutes)}
              >
                Save feed
              </button>
            </>
          )}
        </div>
      )}

      {panel === 'bottle' && (
        <div className="card stack quick-panel">
          <div className="seg" role="group" aria-label="What's in the bottle">
            {BOTTLE_OPTIONS.map((c) => (
              <button key={c} type="button" className={contents === c ? 'on' : ''} onClick={() => setContents(c)}>
                {BOTTLE_LABELS[c]}
              </button>
            ))}
          </div>
          <div className="row">
            <div className="field grow">
              <label htmlFor="quick-amount">Amount (ml)</label>
              <input
                id="quick-amount"
                type="number"
                inputMode="numeric"
                min="0"
                step="5"
                placeholder="90"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={saveBottle}>
              Save
            </button>
          </div>
        </div>
      )}

      {panel === 'nappy' && (
        <div className="card stack quick-panel">
          <div className="row">
            {(Object.keys(NAPPY_LABELS) as NappyKind[]).map((k) => (
              <button
                key={k}
                className="btn btn-primary grow"
                onClick={() => {
                  logNappy(k)
                  setPanel(null)
                }}
              >
                {NAPPY_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
      )}

      {panel === 'sleep' && (
        <div className="card stack quick-panel">
          <p className="tiny muted">
            {openSleep
              ? `She went down at ${formatTime(openSleep.time)}. When did she wake?`
              : 'When did she fall asleep?'}
          </p>
          <button className="btn btn-primary btn-block" onClick={() => saveSleep(new Date())}>
            {openSleep ? 'Woke up just now' : 'Asleep now'}
          </button>
          <div className="row">
            <div className="field grow">
              <label htmlFor="quick-sleep-time">Or a time</label>
              <input
                id="quick-sleep-time"
                type="time"
                value={sleepTime}
                onChange={(e) => {
                  setSleepTime(e.target.value)
                  setSleepError(null)
                }}
              />
            </div>
            <button className="btn" style={{ alignSelf: 'flex-end' }} onClick={saveSleepAtTypedTime}>
              Save
            </button>
          </div>
          {sleepError ? (
            <p className="tiny warn">{sleepError}</p>
          ) : (
            <p className="tiny faint">A time later than now is taken as yesterday evening.</p>
          )}
        </div>
      )}

      {panel === 'medicine' && (
        <div className="card stack quick-panel">
          {recentMedicines.length > 0 && (
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {recentMedicines.map((recent) => (
                <button
                  key={recent.id}
                  className="btn btn-sm"
                  onClick={() => {
                    setMedicineName(recent.name)
                    // the same medicine is nearly always the same dose
                    if (recent.amount) setMedicineAmount(recent.amount)
                  }}
                >
                  {recent.name}
                  {recent.amount ? ` · ${recent.amount}` : ''}
                </button>
              ))}
            </div>
          )}
          <div className="field-row">
            <div className="field" style={{ flex: 2 }}>
              <label htmlFor="quick-medicine">Medication</label>
              <input
                id="quick-medicine"
                type="text"
                autoCapitalize="words"
                placeholder="Paracetamol"
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="quick-dose">Amount</label>
              <input
                id="quick-dose"
                type="text"
                inputMode="decimal"
                placeholder="0.7 ml"
                value={medicineAmount}
                onChange={(e) => setMedicineAmount(e.target.value)}
              />
            </div>
          </div>
          {previousDose && (
            <p className="tiny muted">
              Last {previousDose.name}
              {previousDose.amount ? ` (${previousDose.amount})` : ''} was{' '}
              {formatAgo(previousDose.time, now)}.
            </p>
          )}
          <div className="field">
            <label htmlFor="quick-med-note">Notes</label>
            <textarea
              id="quick-med-note"
              rows={2}
              placeholder="e.g. after her jabs, she was warm"
              value={medicineNote}
              onChange={(e) => setMedicineNote(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary btn-block"
            onClick={saveMedicine}
            disabled={!medicineName.trim()}
          >
            Save dose
          </button>
        </div>
      )}

      {panel === 'pump' && (
        <div className="card stack quick-panel">
          <p className="tiny muted">How much came off each side?</p>
          <div className="field-row">
            <div className="field">
              <label htmlFor="quick-left">Left (ml)</label>
              <input
                id="quick-left"
                type="number"
                inputMode="numeric"
                min="0"
                step="5"
                placeholder="60"
                value={leftMl}
                onChange={(e) => setLeftMl(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="quick-right">Right (ml)</label>
              <input
                id="quick-right"
                type="number"
                inputMode="numeric"
                min="0"
                step="5"
                placeholder="60"
                value={rightMl}
                onChange={(e) => setRightMl(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="quick-pump-mins">Minutes</label>
              <input
                id="quick-pump-mins"
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
          <button
            className="btn btn-primary btn-block"
            onClick={savePump}
            disabled={!positiveNumber(leftMl) && !positiveNumber(rightMl)}
          >
            Save pumping session
          </button>
        </div>
      )}
    </div>
  )
}

function positiveNumber(value: string): number | undefined {
  const n = Number(value)
  return value.trim() && Number.isFinite(n) && n > 0 ? n : undefined
}
