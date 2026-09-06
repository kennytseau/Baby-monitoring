import type { AppState, LogEntry, SyncMeta } from './types'
import { DEFAULT_SYNC_URL } from './syncClient'

export const STORAGE_KEY = 'baby-tracker:state'
export const CURRENT_SCHEMA_VERSION = 3

export function emptyState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: null,
    milestones: [],
    growth: [],
    log: [],
    memories: [],
    sync: { serverUrl: DEFAULT_SYNC_URL || undefined, cursor: 0, pending: [] },
  }
}

/**
 * Parse a persisted JSON string into a valid AppState.
 * Unknown/corrupt data falls back to an empty state rather than crashing;
 * older schema versions get migrated here as the schema evolves.
 */
export function deserializeState(raw: string | null): AppState {
  if (!raw) return emptyState()
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return emptyState()
    const migrated = migrate(parsed as Partial<AppState> & { schemaVersion?: number })
    return {
      ...emptyState(),
      ...migrated,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    }
  } catch {
    return emptyState()
  }
}

function migrate(state: Partial<AppState> & { schemaVersion?: number }): Partial<AppState> {
  let migrated = state
  if ((migrated.schemaVersion ?? 1) < 2) {
    migrated = { ...migrated, log: (migrated.log ?? []).map(migrateLogEntryV1toV2), schemaVersion: 2 }
  }
  if ((migrated.schemaVersion ?? 1) < 3) {
    migrated = migrateV2toV3(migrated)
  }
  // Future migrations go here, e.g.:
  // if (migrated.schemaVersion === 3) { ...transform...; migrated.schemaVersion = 4 }
  return migrated
}

/**
 * Schema 3 added sync. Records written before it get an `updatedAt` from the
 * moment they describe rather than from now, so a freshly migrated device
 * cannot out-rank edits the other phone made in the meantime.
 */
function migrateV2toV3(state: Partial<AppState> & { schemaVersion?: number }): Partial<AppState> {
  const stampedAt = (value: string | undefined): string =>
    value ? new Date(value).toISOString() : new Date(0).toISOString()
  const stamp = <T extends SyncMeta>(item: T, at: string | undefined): T =>
    item.updatedAt ? item : { ...item, updatedAt: stampedAt(at) }

  return {
    ...state,
    schemaVersion: 3,
    profile: state.profile ? stamp(state.profile, state.profile.birthDate) : (state.profile ?? null),
    log: (state.log ?? []).map((entry) => stamp(entry, entry.time)),
    growth: (state.growth ?? []).map((entry) => stamp(entry, entry.date)),
    memories: (state.memories ?? []).map((memory) => stamp(memory, memory.date)),
    milestones: (state.milestones ?? []).map((record) => stamp(record, record.achievedOn)),
    sync: state.sync ?? { serverUrl: DEFAULT_SYNC_URL || undefined, cursor: 0, pending: [] },
  }
}

/** Schema 1 log shapes, kept only so old saved data can be read */
interface LogEntryV1 {
  id: string
  type: 'feed' | 'sleep' | 'diaper'
  time: string
  method?: 'breast-left' | 'breast-right' | 'bottle' | 'solids'
  amountMl?: number
  endTime?: string
  kind?: 'wet' | 'dirty' | 'both'
  note?: string
}

/**
 * v1 knew only `method` on feeds and called nappies "diapers".
 * Breast feeds become nursing sessions with no recorded duration (v1 never had
 * one); bottles keep their amount but their contents are unknown.
 */
function migrateLogEntryV1toV2(raw: LogEntry | LogEntryV1): LogEntry {
  const entry = raw as LogEntryV1
  if (entry.type === 'feed') {
    const base = { id: entry.id, type: 'feed' as const, time: entry.time, note: entry.note }
    switch (entry.method) {
      case 'breast-left':
        return { ...base, kind: 'nursing' }
      case 'breast-right':
        return { ...base, kind: 'nursing' }
      case 'bottle':
        return { ...base, kind: 'bottle', amountMl: entry.amountMl }
      case 'solids':
        return { ...base, kind: 'solids' }
      default:
        return raw as LogEntry
    }
  }
  if (entry.type === 'diaper') {
    const kind = entry.kind === 'dirty' ? 'poo' : entry.kind === 'both' ? 'mixed' : 'wet'
    return { id: entry.id, type: 'nappy', time: entry.time, kind, note: entry.note }
  }
  return raw as LogEntry
}

export function loadState(): AppState {
  if (typeof localStorage === 'undefined') return emptyState()
  return deserializeState(localStorage.getItem(STORAGE_KEY))
}

export function saveState(state: AppState): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearState(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Serialize state for the JSON backup download. The family code is left out:
 * a backup gets emailed around, and it should not carry the key to the log.
 */
export function exportStateJson(state: AppState): string {
  const { sync, ...rest } = state
  void sync
  return JSON.stringify(rest, null, 2)
}

let uidCounter = 0
export function uid(): string {
  uidCounter += 1
  return `${Date.now().toString(36)}-${uidCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
