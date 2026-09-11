import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppState } from '../hooks/useAppState'
import {
  currentPushSubscription,
  disablePush,
  enablePush,
  fetchApplicationServerKey,
  pushAvailability,
  readPushEnvironment,
} from '../lib/push'

/**
 * Turns the running sleep or nursing timer into a lock-screen notification.
 *
 * iOS keeps live counters to native apps, so this is the closest a web app
 * gets: the sync server re-sends the count every few minutes and the phone
 * updates the same notification in place.
 */
export function LockScreenTimer() {
  const { sync } = useAppState()
  const [availability] = useState(() => pushAvailability(readPushEnvironment()))
  const [on, setOn] = useState<boolean | null>(null)
  const [serverKey, setServerKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = availability.state === 'ready' && sync.paired
  const credentials = useMemo(
    () => ({
      serverUrl: sync.serverUrl ?? '',
      householdId: sync.householdId ?? '',
      secret: sync.secret ?? '',
    }),
    [sync.serverUrl, sync.householdId, sync.secret],
  )

  useEffect(() => {
    if (!ready) return
    let live = true
    void currentPushSubscription().then((subscription) => live && setOn(Boolean(subscription)))
    // Fetched up front: Safari only shows the permission prompt if it comes
    // straight off the tap, with no network round trip in between.
    void fetchApplicationServerKey(credentials.serverUrl).then(
      (key) => live && setServerKey(key),
      () => live && setServerKey(null),
    )
    return () => {
      live = false
    }
  }, [ready, credentials.serverUrl])

  const toggle = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      if (on) {
        await disablePush(credentials)
        setOn(false)
      } else {
        if (!serverKey) throw new Error('The sync server is not reachable right now.')
        await enablePush(credentials, serverKey)
        setOn(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }, [on, serverKey, credentials])

  return (
    <div className="stack">
      <span className="item-title">Timer on the lock screen</span>
      <p className="tiny muted">
        While a sleep or nursing timer is running, your phone can show how long it has been going —
        updated every few minutes, on one notification that replaces itself rather than piling up.
      </p>

      {availability.state === 'unsupported' && (
        <p className="tiny faint">
          This browser cannot show notifications from a web app. On an iPhone, open the site in Safari
          and add it to the Home Screen.
        </p>
      )}

      {availability.state === 'install-first' && (
        <p className="tiny faint">
          iOS only offers notifications to a web app that lives on the Home Screen. Tap the Share
          button, choose <strong>Add to Home Screen</strong>, open Little One from the new icon, then
          come back here.
        </p>
      )}

      {availability.state === 'ready' && !sync.paired && (
        <p className="tiny faint">
          The updates are sent by your sync server, so set up the shared log above first.
        </p>
      )}

      {ready && (
        <>
          <button className="btn btn-block" disabled={busy || on === null} onClick={() => void toggle()}>
            {busy
              ? 'Working…'
              : on === null
                ? 'Checking…'
                : on
                  ? 'Turn off lock-screen updates'
                  : 'Turn on lock-screen updates'}
          </button>
          {on === true && (
            <p className="tiny faint">
              On for this phone. Turn it on separately on the other phone if you both want it.
            </p>
          )}
          {error && <p className="tiny warn">{error}</p>}
        </>
      )}
    </div>
  )
}
