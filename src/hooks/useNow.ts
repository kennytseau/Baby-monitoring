import { useEffect, useState } from 'react'

/**
 * A Date that refreshes on an interval, so running timers (nursing, sleep,
 * wake windows) count up on screen without every component owning a timer.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
