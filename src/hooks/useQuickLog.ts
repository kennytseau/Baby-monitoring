import { useCallback, useMemo } from 'react'
import { useAppState } from './useAppState'
import { uid } from '../lib/storage'
import {
  commitNursingSide,
  findOpenSleep,
  findRunningNursing,
  startNursingSession,
  switchNursingSide,
} from '../lib/log'
import type { BottleContent, BreastSide, NappyKind } from '../lib/types'

/**
 * The one-tap actions shared by Home and the Daily log, so both screens drive
 * the same nursing timer and the same open sleep.
 */
export function useQuickLog() {
  const { state, addLog, updateLog } = useAppState()
  const openSleep = useMemo(() => findOpenSleep(state.log), [state.log])
  const runningNursing = useMemo(() => findRunningNursing(state.log), [state.log])

  /** Start nursing on a side — or switch sides if a session is already running */
  const nurse = useCallback(
    (side: BreastSide) => {
      const now = new Date()
      if (!runningNursing) {
        addLog(startNursingSession(uid(), side, now))
        return
      }
      if (runningNursing.activeSide === side) return
      updateLog(switchNursingSide(runningNursing, side, now))
    },
    [runningNursing, addLog, updateLog],
  )

  const finishNursing = useCallback(() => {
    if (runningNursing) updateLog(commitNursingSide(runningNursing, new Date()))
  }, [runningNursing, updateLog])

  /** Log a nursing session that was not timed — the minutes are typed in afterwards */
  const logNursingMinutes = useCallback(
    (leftMinutes?: number, rightMinutes?: number) => {
      addLog({
        id: uid(),
        type: 'feed',
        kind: 'nursing',
        time: new Date().toISOString(),
        leftMinutes,
        rightMinutes,
      })
    },
    [addLog],
  )

  /** She has gone down — `at` defaults to now, or set it if you are logging late */
  const startSleep = useCallback(
    (at: Date = new Date()) => {
      addLog({ id: uid(), type: 'sleep', time: at.toISOString() })
    },
    [addLog],
  )

  /** She has woken — `at` defaults to now */
  const endSleep = useCallback(
    (at: Date = new Date()) => {
      if (openSleep) updateLog({ ...openSleep, endTime: at.toISOString() })
    },
    [openSleep, updateLog],
  )

  const logNappy = useCallback(
    (kind: NappyKind) => {
      addLog({ id: uid(), type: 'nappy', time: new Date().toISOString(), kind })
    },
    [addLog],
  )

  const logBottle = useCallback(
    (contents: BottleContent, amountMl?: number) => {
      addLog({
        id: uid(),
        type: 'feed',
        kind: 'bottle',
        time: new Date().toISOString(),
        contents,
        amountMl,
      })
    },
    [addLog],
  )

  const logPump = useCallback(
    (leftMl?: number, rightMl?: number, durationMinutes?: number) => {
      addLog({
        id: uid(),
        type: 'pump',
        time: new Date().toISOString(),
        leftMl,
        rightMl,
        durationMinutes,
      })
    },
    [addLog],
  )

  return {
    openSleep,
    runningNursing,
    nurse,
    finishNursing,
    logNursingMinutes,
    startSleep,
    endSleep,
    logNappy,
    logBottle,
    logPump,
  }
}
