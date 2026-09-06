import { useState } from 'react'
import { useAppState } from '../hooks/useAppState'
import { useNow } from '../hooks/useNow'
import { formatFamilyCode, parseFamilyCode } from '../lib/sync'
import { DEFAULT_SYNC_URL } from '../lib/syncClient'
import { formatAgo } from '../lib/format'

type Mode = 'menu' | 'create' | 'join'

/**
 * Pairing and sync status: one phone creates the shared log and reads out the
 * family code, the other joins with it. After that both phones keep the same
 * day whenever they have signal.
 */
export function SharingPanel() {
  const { sync, startSharing, joinSharing, stopSharing, syncNow } = useAppState()
  const now = useNow(30_000)
  const [mode, setMode] = useState<Mode>('menu')
  const [serverUrl, setServerUrl] = useState(sync.serverUrl ?? DEFAULT_SYNC_URL)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)

  async function handleCreate() {
    setBusy(true)
    setFormError(null)
    try {
      await startSharing(serverUrl.trim())
      setMode('menu')
      setShowCode(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create the shared log.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin() {
    const parsed = parseFamilyCode(code)
    if (!parsed) {
      setFormError('That does not look like a family code — it is 30 characters long.')
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      await joinSharing(serverUrl.trim(), parsed.householdId, parsed.secret)
      await syncNow()
      setMode('menu')
      setCode('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not join that log.')
    } finally {
      setBusy(false)
    }
  }

  async function copyCode(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setShowCode(true)
    }
  }

  if (sync.paired) {
    const familyCode = formatFamilyCode(sync.householdId!, sync.secret!)
    return (
      <div className="stack">
        <div className="row-between">
          <span className="item-title">Shared log</span>
          <span className={`chip ${sync.status === 'error' ? 'chip-warn' : 'chip-good'}`}>
            {sync.status === 'syncing'
              ? 'syncing…'
              : sync.status === 'error'
                ? 'not synced'
                : sync.pendingCount > 0
                  ? `${sync.pendingCount} waiting`
                  : 'in sync'}
          </span>
        </div>
        <p className="tiny muted">
          {sync.lastSyncedAt ? `Last synced ${formatAgo(sync.lastSyncedAt, now)}.` : 'Not synced yet.'}
          {sync.pendingCount > 0
            ? ` ${sync.pendingCount} change${sync.pendingCount === 1 ? '' : 's'} saved here, waiting to go up.`
            : ''}
        </p>
        {sync.error && <p className="tiny warn">{sync.error}</p>}

        <div className="field">
          <label htmlFor="family-code">Family code — enter this on the other phone</label>
          <input
            id="family-code"
            readOnly
            type={showCode ? 'text' : 'password'}
            value={familyCode}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
        <div className="row">
          <button className="btn btn-sm" onClick={() => setShowCode((v) => !v)}>
            {showCode ? 'Hide' : 'Show'}
          </button>
          <button className="btn btn-sm" onClick={() => copyCode(familyCode)}>
            {copied ? 'Copied ✓' : 'Copy code'}
          </button>
          <button className="btn btn-sm" onClick={() => void syncNow()} disabled={sync.status === 'syncing'}>
            Sync now
          </button>
        </div>
        <p className="tiny faint">
          Anyone with this code can read and add to the log — treat it like a house key. It is stored
          only on your phones and never appears in a backup file.
        </p>

        {confirmStop ? (
          <div className="row">
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                setConfirmStop(false)
                stopSharing()
              }}
            >
              Yes, unlink this phone
            </button>
            <button className="btn btn-sm" onClick={() => setConfirmStop(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmStop(true)}>
            Stop syncing on this phone…
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="stack">
      <span className="item-title">Share with your partner</span>
      <p className="tiny muted">
        Right now this log lives only on this phone. Create a shared log here, then enter the family
        code on the other phone — after that you both see the same day, and entries made offline go
        up as soon as there is signal.
      </p>

      {mode === 'menu' && (
        <div className="row">
          <button className="btn btn-primary grow" onClick={() => setMode('create')}>
            Create shared log
          </button>
          <button className="btn grow" onClick={() => setMode('join')}>
            Join with a code
          </button>
        </div>
      )}

      {mode !== 'menu' && (
        <div className="stack">
          <div className="field">
            <label htmlFor="sync-url">Sync server</label>
            <input
              id="sync-url"
              type="url"
              inputMode="url"
              placeholder="https://baby-log-sync.yourname.workers.dev"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
            />
          </div>

          {mode === 'join' && (
            <div className="field">
              <label htmlFor="join-code">Family code from the other phone</label>
              <input
                id="join-code"
                type="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="01234-56789-ABCDE-FGHJK-MNPQR-STVWX"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <span className="tiny faint">
                Entries already on this phone are merged into the shared log.
              </span>
            </div>
          )}

          {formError && <p className="tiny warn">{formError}</p>}

          <div className="row">
            <button
              className="btn btn-primary"
              disabled={busy || !serverUrl.trim() || (mode === 'join' && !code.trim())}
              onClick={() => void (mode === 'create' ? handleCreate() : handleJoin())}
            >
              {busy ? 'Working…' : mode === 'create' ? 'Create shared log' : 'Join log'}
            </button>
            <button
              className="btn"
              onClick={() => {
                setMode('menu')
                setFormError(null)
              }}
            >
              Cancel
            </button>
          </div>
          <p className="tiny faint">
            The sync server is the Cloudflare Worker in <code>worker/</code> — deploy it once and paste
            its URL here (see the README).
          </p>
        </div>
      )}
    </div>
  )
}
