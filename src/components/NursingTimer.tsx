import { useNow } from '../hooks/useNow'
import { useQuickLog } from '../hooks/useQuickLog'
import { isNursingRunning, sideMinutes } from '../lib/log'
import { formatStopwatch, formatTime } from '../lib/format'
import type { BreastSide } from '../lib/types'

/**
 * The open nursing session: a live stopwatch for the side she is on, with one
 * tap to switch sides, one to pause when she comes off for a burp or a nappy,
 * and one to finish. Nothing renders when no session is open.
 */
export function NursingTimer() {
  const { openNursing, nurse, pauseNursing, resumeNursing, finishNursing } = useQuickLog()
  const now = useNow(1000)
  if (!openNursing) return null

  const running = isNursingRunning(openNursing)
  const left = sideMinutes(openNursing, 'left', now)
  const right = sideMinutes(openNursing, 'right', now)
  const active = openNursing.activeSide as BreastSide

  return (
    <section className={`card card-tinted timer-card${running ? '' : ' timer-paused'}`} aria-live="polite">
      <div className="row-between">
        <h2 className="item-title">
          {running ? `Nursing — ${active} side` : `Paused — ${active} side`}
        </h2>
        <span className="tiny muted">started {formatTime(openNursing.time)}</span>
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

      <div className="row">
        <button
          className="btn grow"
          onClick={running ? pauseNursing : resumeNursing}
          aria-pressed={!running}
        >
          {running ? '⏸ Pause' : '▶ Resume'}
        </button>
        <button className="btn btn-primary grow" onClick={finishNursing}>
          Finish feed
        </button>
      </div>
      {!running && <p className="tiny muted">Held at {formatStopwatch(left + right)} — nothing is counting.</p>}
    </section>
  )
}
