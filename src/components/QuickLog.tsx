import { useMemo, useState } from 'react'
import { useNow } from '../hooks/useNow'
import { useAppState } from '../hooks/useAppState'
import { useQuickLog } from '../hooks/useQuickLog'
import { NursingTimer } from './NursingTimer'
import { BOTTLE_LABELS, BOTTLE_OPTIONS, NAPPY_LABELS, sleepMinutes, sortedByTime } from '../lib/log'
import { formatAgo, formatDuration, formatTime, resolveLogTime, toTimeInput } from '../lib/format'
import type { BottleContent, MedicationEntry, NappyKind } from '../lib/types'

type Panel = 'nurse' | 'bottle' | 'nappy' | 'sleep' | 'medicine' | 'pump' | null

/** The one-tap "a few minutes ago" offsets, in minutes */
const QUICK_OFFSETS = [5, 10, 15, 30]

/**
 * The logging surface used on Home and in the Daily log: one tap opens a small
 * panel, a second tap records the entry with the time it happened.
 */
export function QuickLog() {
  const {
    openSleep,
    openNursing,
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
  const [sleepError, setSleepError] = useState<string | null>(null)
  /** How far back the next entry is being logged: 0 is now */
  const [offsetMinutes, setOffsetMinutes] = useState(0)
  const [exactTime, setExactTime] = useState('')
  const [pickingTime, setPickingTime] = useState(false)
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

  /** The moment the next entry is stamped with, worked out at the tap that saves it */
  function logAt(): Date {
    return resolveLogTime({ offsetMinutes, exactTime: exactTime || undefined })
  }

  /**
   * Back to "now" after every entry. Leaving it set is how you end up logging a
   * whole evening ten minutes in the past without noticing.
   */
  function resetTime() {
    setOffsetMinutes(0)
    setExactTime('')
    setPickingTime(false)
  }

  const backdated = offsetMinutes > 0 || !!exactTime

  function toggle(next: Exclude<Panel, null>) {
    setPanel((p) => {
      if (p === next) return null
      if (next === 'sleep') setSleepError(null)
      return next
    })
  }

  /** Log a nursing session from typed minutes, for when the timer was not started */
  function saveNursingMinutes() {
    const left = positiveNumber(leftMinutes)
    const right = positiveNumber(rightMinutes)
    if (!left && !right) return
    logNursingMinutes(left, right, logAt())
    setLeftMinutes('')
    setRightMinutes('')
    setPanel(null)
    resetTime()
  }

  /** Record going down or waking, at whatever the time strip says */
  function saveSleep() {
    const at = logAt()
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
    resetTime()
  }

  function saveBottle() {
    logBottle(contents, positiveNumber(amount), logAt())
    setAmount('')
    setPanel(null)
    resetTime()
  }

  function saveMedicine() {
    if (!medicineName.trim()) return
    logMedication(medicineName, medicineAmount, medicineNote, logAt())
    setMedicineName('')
    setMedicineAmount('')
    setMedicineNote('')
    setPanel(null)
    resetTime()
  }

  function savePump() {
    if (!positiveNumber(leftMl) && !positiveNumber(rightMl)) return
    logPump(positiveNumber(leftMl), positiveNumber(rightMl), positiveNumber(pumpMinutes), logAt())
    setLeftMl('')
    setRightMl('')
    setPumpMinutes('')
    setPanel(null)
    resetTime()
  }

  return (
    <div className="stack">
      <NursingTimer />

      {/* One time control for all six actions: tap an offset, then tap what happened */}
      <div className="time-strip">
        <span className="time-strip-label">Logging</span>
        <div className="time-strip-chips">
          <button
            className={`chip-btn${!backdated ? ' on' : ''}`}
            onClick={resetTime}
            aria-pressed={!backdated}
          >
            now
          </button>
          {QUICK_OFFSETS.map((minutes) => (
            <button
              key={minutes}
              className={`chip-btn${!exactTime && offsetMinutes === minutes ? ' on' : ''}`}
              aria-pressed={!exactTime && offsetMinutes === minutes}
              onClick={() => {
                setOffsetMinutes(minutes)
                setExactTime('')
                setPickingTime(false)
              }}
            >
              −{minutes}m
            </button>
          ))}
          <button
            className={`chip-btn${exactTime ? ' on' : ''}`}
            aria-pressed={!!exactTime}
            aria-label="Set an exact time"
            onClick={() => {
              setPickingTime((open) => !open)
              if (!exactTime) setExactTime(toTimeInput(new Date()))
            }}
          >
            🕑
          </button>
        </div>
      </div>

      {pickingTime && (
        <div className="row">
          <div className="field grow">
            <label htmlFor="quick-at">Time it happened</label>
            <input
              id="quick-at"
              type="time"
              value={exactTime}
              onChange={(e) => {
                setExactTime(e.target.value)
                setOffsetMinutes(0)
              }}
            />
          </div>
          <button className="btn btn-sm" style={{ alignSelf: 'flex-end' }} onClick={resetTime}>
            Back to now
          </button>
        </div>
      )}

      {backdated && (
        <p className="tiny warn" role="status">
          Logging at {formatTime(logAt())} — {formatDuration(
            Math.max(1, (now.getTime() - logAt().getTime()) / 60_000),
          )}{' '}
          ago. Back to now after it saves.
        </p>
      )}

      <div className="quick-btns quick-btns-6">
        <button
          className={`quick-btn${openNursing ? ' quick-btn-on' : ''}`}
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
            {runningNursing
              ? 'Switch sides — the timer keeps running.'
              : openNursing
                ? 'Tap a side to start the clock again.'
                : 'Which side is she on?'}
          </p>
          <div className="row">
            <button
              className="btn btn-primary grow"
              onClick={() => {
                nurse('left', logAt())
                setPanel(null)
                resetTime()
              }}
            >
              Left
            </button>
            <button
              className="btn btn-primary grow"
              onClick={() => {
                nurse('right', logAt())
                setPanel(null)
                resetTime()
              }}
            >
              Right
            </button>
          </div>

          {!openNursing && (
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
                  logNappy(k, logAt())
                  setPanel(null)
                  resetTime()
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
              ? `She went down at ${formatTime(openSleep.time)}. Set the time above if she woke earlier.`
              : 'Set the time above if she went down a while ago.'}
          </p>
          <button className="btn btn-primary btn-block" onClick={saveSleep}>
            {openSleep ? 'Woke up' : 'Asleep'} {backdated ? `at ${formatTime(logAt())}` : 'now'}
          </button>
          {sleepError && <p className="tiny warn">{sleepError}</p>}
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
