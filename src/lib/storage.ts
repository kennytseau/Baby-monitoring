import type { AppState } from './types'

export const STORAGE_KEY = 'baby-tracker:state'
export const CURRENT_SCHEMA_VERSION = 1

export function emptyState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: null,
    milestones: [],
    growth: [],
    log: [],
    memories: [],
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
  // Future migrations go here, e.g.:
  // if (state.schemaVersion === 1) { ...transform...; state.schemaVersion = 2 }
  return state
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

/** Serialize state for the JSON backup download */
export function exportStateJson(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

let uidCounter = 0
export function uid(): string {
  uidCounter += 1
  return `${Date.now().toString(36)}-${uidCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
