import { useCallback, useMemo } from 'react'
import { useAppState } from './useAppState'
import { uid } from '../lib/storage'
import {
  findOpenNursing,
  findOpenSleep,
  finishNursing as finishNursingSession,
  isNursingRunning,
  pauseNursing as pauseNursingSession,
  resumeNursing as resumeNursingSession,
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
  /** Started and not finished — the timer card follows this, running or paused */
  const openNursing = useMemo(() => findOpenNursing(state.log), [state.log])
  const runningNursing = useMemo(
    () => (openNursing && isNursingRunning(openNursing) ? openNursing : undefined),
    [openNursing],
  )

  /**
   * Start nursing on a side — or switch sides if a session is already running.
   * `at` lets a feed be logged after the fact, and the timer then opens with
   * that time already on the clock.
   */
  const nurse = useCallback(
    (side: BreastSide, at: Date = new Date()) => {
      if (!openNursing) {
        addLog(startNursingSession(uid(), side, at))
        return
      }
      // Tapping the side she is already on does nothing; tapping it while
      // paused starts the clock again rather than opening a second feed.
      if (openNursing.activeSide === side && isNursingRunning(openNursing)) return
      updateLog(switchNursingSide(openNursing, side, at))
    },
    [openNursing, addLog, updateLog],
  )

  const pauseNursing = useCallback(() => {
    if (runningNursing) updateLog(pauseNursingSession(runningNursing, new Date()))
  }, [runningNursing, updateLog])

  const resumeNursing = useCallback(() => {
    if (openNursing) updateLog(resumeNursingSession(openNursing, new Date()))
  }, [openNursing, updateLog])

  const finishNursing = useCallback(() => {
    if (openNursing) updateLog(finishNursingSession(openNursing, new Date()))
  }, [openNursing, updateLog])

  /** Log a nursing session that was not timed — the minutes are typed in afterwards */
  const logNursingMinutes = useCallback(
    (leftMinutes?: number, rightMinutes?: number, at: Date = new Date()) => {
      addLog({
        id: uid(),
        type: 'feed',
        kind: 'nursing',
        time: at.toISOString(),
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
    (kind: NappyKind, at: Date = new Date()) => {
      addLog({ id: uid(), type: 'nappy', time: at.toISOString(), kind })
    },
    [addLog],
  )

  const logBottle = useCallback(
    (contents: BottleContent, amountMl?: number, at: Date = new Date()) => {
      addLog({
        id: uid(),
        type: 'feed',
        kind: 'bottle',
        time: at.toISOString(),
        contents,
        amountMl,
      })
    },
    [addLog],
  )

  const logMedication = useCallback(
    (name: string, amount?: string, note?: string, at: Date = new Date()) => {
      addLog({
        id: uid(),
        type: 'medication',
        time: at.toISOString(),
        name: name.trim(),
        amount: amount?.trim() || undefined,
        note: note?.trim() || undefined,
      })
    },
    [addLog],
  )

  const logPump = useCallback(
    (leftMl?: number, rightMl?: number, durationMinutes?: number, at: Date = new Date()) => {
      addLog({
        id: uid(),
        type: 'pump',
        time: at.toISOString(),
        leftMl,
        rightMl,
        durationMinutes,
      })
    },
    [addLog],
  )

  return {
    openSleep,
    openNursing,
    runningNursing,
    nurse,
    pauseNursing,
    resumeNursing,
    finishNursing,
    logNursingMinutes,
    startSleep,
    endSleep,
    logNappy,
    logBottle,
    logMedication,
    logPump,
  }
}
