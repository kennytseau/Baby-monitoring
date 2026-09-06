import { useEffect, useState } from 'react'
import { useAppState } from '../hooks/useAppState'

/**
 * A quiet line across the top when the shared log is behind: changes waiting to
 * go up, or a server that cannot be reached. It says nothing at all when
 * everything is in sync, which is most of the time.
 */
export function SyncBanner() {
  const { sync, syncNow } = useAppState()
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!sync.paired) return null
  const waiting = sync.pendingCount
  if (waiting === 0 && sync.status !== 'error') return null

  const message = !online
    ? `Offline — ${waiting} change${waiting === 1 ? '' : 's'} saved here, waiting`
    : sync.status === 'error'
      ? `Not synced${waiting ? ` — ${waiting} change${waiting === 1 ? '' : 's'} waiting` : ''}`
      : `${waiting} change${waiting === 1 ? '' : 's'} waiting to sync`

  return (
    <div className={`sync-banner${sync.status === 'error' && online ? ' sync-banner-error' : ''}`} role="status">
      <span>{message}</span>
      {online && (
        <button className="btn btn-ghost btn-sm" onClick={() => void syncNow()} disabled={sync.status === 'syncing'}>
          {sync.status === 'syncing' ? 'Syncing…' : 'Retry'}
        </button>
      )}
    </div>
  )
}
