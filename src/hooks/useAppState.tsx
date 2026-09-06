import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AppState,
  BabyProfile,
  GrowthEntry,
  LogEntry,
  Memory,
} from '../lib/types'
import { clearState, exportStateJson, loadState, saveState } from '../lib/storage'
import {
  allRecordKeys,
  applyLocalChange,
  applyLocalDelete,
  applyRemoteRecords,
  recordsForKeys,
  visibleState,
} from '../lib/sync'
import type { Collection } from '../lib/sync'
import { MAX_CHANGES_PER_PUSH, SyncError, createHousehold, pushPull } from '../lib/syncClient'

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error'

export interface SyncView {
  status: SyncStatus
  paired: boolean
  householdId?: string
  secret?: string
  serverUrl?: string
  pendingCount: number
  lastSyncedAt?: string
  error?: string
}

interface AppStateContextValue {
  state: AppState
  setProfile: (profile: BabyProfile) => void
  setMilestoneAchieved: (milestoneId: string, achievedOn: string | null) => void
  addGrowth: (entry: GrowthEntry) => void
  updateGrowth: (entry: GrowthEntry) => void
  deleteGrowth: (id: string) => void
  addLog: (entry: LogEntry) => void
  updateLog: (entry: LogEntry) => void
  deleteLog: (id: string) => void
  addMemory: (memory: Memory) => void
  updateMemory: (memory: Memory) => void
  deleteMemory: (id: string) => void
  exportData: () => void
  resetAll: () => void
  sync: SyncView
  startSharing: (serverUrl: string) => Promise<void>
  joinSharing: (serverUrl: string, householdId: string, secret: string) => Promise<void>
  stopSharing: () => void
  syncNow: () => Promise<void>
}

const AppStateContext = createContext<AppStateContextValue | null>(null)

/** How often a paired device checks in with the server while the app is open */
const SYNC_INTERVAL_MS = 20_000
/** A local change pushes almost immediately, but batched if several land together */
const SYNC_DEBOUNCE_MS = 1_500

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<AppState>(() => loadState())
  const [status, setStatus] = useState<SyncStatus>('off')

  // The sync engine reads the newest document without re-subscribing on every keystroke
  const docRef = useRef(doc)
  docRef.current = doc
  const running = useRef(false)
  const rerunRequested = useRef(false)

  useEffect(() => {
    saveState(doc)
  }, [doc])

  const change = useCallback((collection: Collection, item: Parameters<typeof applyLocalChange>[2]) => {
    setDoc((s) => applyLocalChange(s, collection, item))
  }, [])
  const remove = useCallback((collection: Collection, id: string) => {
    setDoc((s) => applyLocalDelete(s, collection, id))
  }, [])

  const setProfile = useCallback((profile: BabyProfile) => change('profile', profile), [change])

  const setMilestoneAchieved = useCallback(
    (milestoneId: string, achievedOn: string | null) => {
      if (achievedOn) change('milestones', { milestoneId, achievedOn })
      else remove('milestones', milestoneId)
    },
    [change, remove],
  )

  const addGrowth = useCallback((entry: GrowthEntry) => change('growth', entry), [change])
  const updateGrowth = useCallback((entry: GrowthEntry) => change('growth', entry), [change])
  const deleteGrowth = useCallback((id: string) => remove('growth', id), [remove])

  const addLog = useCallback((entry: LogEntry) => change('log', entry), [change])
  const updateLog = useCallback((entry: LogEntry) => change('log', entry), [change])
  const deleteLog = useCallback((id: string) => remove('log', id), [remove])

  const addMemory = useCallback((memory: Memory) => change('memories', memory), [change])
  const updateMemory = useCallback((memory: Memory) => change('memories', memory), [change])
  const deleteMemory = useCallback((id: string) => remove('memories', id), [remove])

  const exportData = useCallback(() => {
    const blob = new Blob([exportStateJson(docRef.current)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `baby-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const resetAll = useCallback(() => {
    clearState()
    setDoc(loadState())
    setStatus('off')
  }, [])

  /** One push/pull round trip; safe to call from anywhere, it never runs twice at once */
  const syncNow = useCallback(async () => {
    const current = docRef.current
    const { householdId, secret, serverUrl, cursor, pending } = current.sync
    if (!householdId || !secret || !serverUrl) return
    if (running.current) {
      rerunRequested.current = true
      return
    }
    running.current = true
    setStatus('syncing')
    const pushing = pending.slice(0, MAX_CHANGES_PER_PUSH)
    try {
      const response = await pushPull(
        { serverUrl, householdId, secret },
        cursor,
        recordsForKeys(current, pushing),
      )
      setDoc((s) => {
        const merged = applyRemoteRecords(s, response.changes)
        return {
          ...merged,
          sync: {
            ...merged.sync,
            cursor: response.cursor,
            // Anything queued while the request was in flight stays queued
            pending: merged.sync.pending.filter((key) => !pushing.includes(key)),
            lastSyncedAt: new Date().toISOString(),
            lastError: undefined,
          },
        }
      })
      setStatus('idle')
      // More history to walk, or changes that did not fit in this push
      if (response.more || pending.length > pushing.length) rerunRequested.current = true
    } catch (err) {
      const message = err instanceof SyncError ? err.message : 'Sync failed.'
      setDoc((s) => ({ ...s, sync: { ...s.sync, lastError: message } }))
      setStatus('error')
    } finally {
      running.current = false
      if (rerunRequested.current) {
        rerunRequested.current = false
        void syncNow()
      }
    }
  }, [])

  /** Create the shared log and seed it with everything already on this device */
  const startSharing = useCallback(
    async (serverUrl: string) => {
      const created = await createHousehold(serverUrl)
      setDoc((s) => ({
        ...s,
        sync: {
          serverUrl,
          householdId: created.householdId,
          secret: created.secret,
          cursor: 0,
          pending: allRecordKeys(s),
          lastError: undefined,
        },
      }))
      setStatus('idle')
    },
    [],
  )

  /** Join the log the other phone created; this device's entries merge into it */
  const joinSharing = useCallback(
    async (serverUrl: string, householdId: string, secret: string) => {
      setDoc((s) => ({
        ...s,
        sync: { serverUrl, householdId, secret, cursor: 0, pending: allRecordKeys(s), lastError: undefined },
      }))
      setStatus('idle')
    },
    [],
  )

  const stopSharing = useCallback(() => {
    setDoc((s) => ({ ...s, sync: { serverUrl: s.sync.serverUrl, cursor: 0, pending: [] } }))
    setStatus('off')
  }, [])

  const paired = !!(doc.sync.householdId && doc.sync.secret && doc.sync.serverUrl)
  const pendingCount = doc.sync.pending.length

  // Sync on pairing, on a timer, when the app comes back to the foreground, and
  // shortly after a local change.
  useEffect(() => {
    if (!paired) {
      setStatus('off')
      return
    }
    void syncNow()
    const interval = setInterval(() => void syncNow(), SYNC_INTERVAL_MS)
    const onWake = () => {
      if (document.visibilityState === 'visible') void syncNow()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', onWake)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('online', onWake)
    }
  }, [paired, doc.sync.householdId, syncNow])

  useEffect(() => {
    if (!paired || pendingCount === 0) return
    const timer = setTimeout(() => void syncNow(), SYNC_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [paired, pendingCount, syncNow])

  const state = useMemo(() => visibleState(doc), [doc])
  const sync = useMemo<SyncView>(
    () => ({
      status: paired ? status : 'off',
      paired,
      householdId: doc.sync.householdId,
      secret: doc.sync.secret,
      serverUrl: doc.sync.serverUrl,
      pendingCount,
      lastSyncedAt: doc.sync.lastSyncedAt,
      error: doc.sync.lastError,
    }),
    [paired, status, doc.sync, pendingCount],
  )

  const value = useMemo(
    () => ({
      state,
      setProfile,
      setMilestoneAchieved,
      addGrowth,
      updateGrowth,
      deleteGrowth,
      addLog,
      updateLog,
      deleteLog,
      addMemory,
      updateMemory,
      deleteMemory,
      exportData,
      resetAll,
      sync,
      startSharing,
      joinSharing,
      stopSharing,
      syncNow,
    }),
    [
      state,
      setProfile,
      setMilestoneAchieved,
      addGrowth,
      updateGrowth,
      deleteGrowth,
      addLog,
      updateLog,
      deleteLog,
      addMemory,
      updateMemory,
      deleteMemory,
      exportData,
      resetAll,
      sync,
      startSharing,
      joinSharing,
      stopSharing,
      syncNow,
    ],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
