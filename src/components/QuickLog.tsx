import { useState } from 'react'
import { useNow } from '../hooks/useNow'
import { useQuickLog } from '../hooks/useQuickLog'
import { NursingTimer } from './NursingTimer'
import { BOTTLE_LABELS, NAPPY_LABELS, sleepMinutes } from '../lib/log'
import { formatDuration, formatTime } from '../lib/format'
import type { BottleContent, NappyKind } from '../lib/types'

type Panel = 'nurse' | 'bottle' | 'nappy' | 'pump' | null

/**
 * The logging surface used on Home and in the Daily log: one tap opens a small
 * panel, a second tap records the entry with the time it happened.
 */
export function QuickLog() {
  const { openSleep, runningNursing, nurse, toggleSleep, logNappy, logBottle, logPump } =
    useQuickLog()
  const now = useNow(30_000)
  const [panel, setPanel] = useState<Panel>(null)

  const [contents, setContents] = useState<BottleContent>('formula')
  const [amount, setAmount] = useState('')
  const [leftMl, setLeftMl] = useState('')
  const [rightMl, setRightMl] = useState('')
  const [pumpMinutes, setPumpMinutes] = useState('')

  function toggle(next: Exclude<Panel, null>) {
    setPanel((p) => (p === next ? null : next))
  }

  function saveBottle() {
    logBottle(contents, positiveNumber(amount))
    setAmount('')
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

      <div className="quick-btns quick-btns-5">
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
          onClick={() => {
            toggleSleep()
            setPanel(null)
          }}
        >
          <span aria-hidden="true">{openSleep ? '☀️' : '😴'}</span>
          {openSleep ? 'Woke up' : 'Sleep'}
        </button>
        <button className="quick-btn" onClick={() => toggle('pump')} aria-expanded={panel === 'pump'}>
          <span aria-hidden="true">🥛</span> Pump
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
        </div>
      )}

      {panel === 'bottle' && (
        <div className="card stack quick-panel">
          <div className="seg" role="group" aria-label="What's in the bottle">
            {(Object.keys(BOTTLE_LABELS) as BottleContent[]).map((c) => (
              <button key={c} type="button" className={contents === c ? 'on' : ''} onClick={() => setContents(c)}>
                {c === 'mixed' ? 'Both' : BOTTLE_LABELS[c]}
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
