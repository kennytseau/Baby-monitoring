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

  /** Put her down / note that she woke */
  const toggleSleep = useCallback(() => {
    if (openSleep) updateLog({ ...openSleep, endTime: new Date().toISOString() })
    else addLog({ id: uid(), type: 'sleep', time: new Date().toISOString() })
  }, [openSleep, addLog, updateLog])

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

  return { openSleep, runningNursing, nurse, finishNursing, toggleSleep, logNappy, logBottle, logPump }
}
