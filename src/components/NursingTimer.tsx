import { useNow } from '../hooks/useNow'
import { useQuickLog } from '../hooks/useQuickLog'
import { sideMinutes } from '../lib/log'
import { formatStopwatch, formatTime } from '../lib/format'
import type { BreastSide } from '../lib/types'

/**
 * The running nursing session: a live stopwatch for the side she's on, with
 * one tap to switch sides and one to finish. Nothing renders when no session
 * is running.
 */
export function NursingTimer() {
  const { runningNursing, nurse, finishNursing } = useQuickLog()
  const now = useNow(1000)
  if (!runningNursing) return null

  const left = sideMinutes(runningNursing, 'left', now)
  const right = sideMinutes(runningNursing, 'right', now)
  const active = runningNursing.activeSide as BreastSide

  return (
    <section className="card card-tinted timer-card" aria-live="polite">
      <div className="row-between">
        <h2 className="item-title">Nursing — {active === 'left' ? 'left' : 'right'} side</h2>
        <span className="tiny muted">started {formatTime(runningNursing.time)}</span>
      </div>
      <div className="timer-readout">{formatStopwatch(left + right)}</div>
      <div className="timer-sides">
        <span className={active === 'left' ? 'on' : undefined}>L {formatStopwatch(left)}</span>
        <span className={active === 'right' ? 'on' : undefined}>R {formatStopwatch(right)}</span>
      </div>
      <div className="seg" role="group" aria-label="Side">
        <button type="button" className={active === 'left' ? 'on' : ''} onClick={() => nurse('left')}>
          Left
        </button>
        <button type="button" className={active === 'right' ? 'on' : ''} onClick={() => nurse('right')}>
          Right
        </button>
      </div>
      <button className="btn btn-primary btn-block" onClick={finishNursing}>
        Finish feed
      </button>
    </section>
  )
}
