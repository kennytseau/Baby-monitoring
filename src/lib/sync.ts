import type { AppState, BabyProfile, GrowthEntry, LogEntry, Memory, MilestoneRecord } from './types'

/** The collections that sync between devices */
export const COLLECTIONS = ['log', 'growth', 'memories', 'milestones', 'profile'] as const
export type Collection = (typeof COLLECTIONS)[number]

/** The wire shape of one synced record */
export interface SyncRecord {
  collection: Collection
  id: string
  updatedAt: string
  deletedAt?: string
  data?: unknown
}

export interface SyncResponse {
  cursor: number
  more?: boolean
  changes: SyncRecord[]
  serverTime?: string
}

/** Records older than this are treated as ancient — only migrated data lacks a stamp */
const EPOCH = '1970-01-01T00:00:00.000Z'
/** The profile is a single record, so it needs a fixed id */
export const PROFILE_ID = 'profile'

export function recordKey(collection: Collection, id: string): string {
  return `${collection}:${id}`
}

export function parseRecordKey(key: string): { collection: Collection; id: string } | null {
  const index = key.indexOf(':')
  if (index < 1) return null
  const collection = key.slice(0, index) as Collection
  if (!COLLECTIONS.includes(collection)) return null
  return { collection, id: key.slice(index + 1) }
}

type AnyRecord = LogEntry | GrowthEntry | Memory | MilestoneRecord | BabyProfile

/** The id a record syncs under — milestones key on their milestone, the profile is a singleton */
function idOf(collection: Collection, item: AnyRecord): string {
  if (collection === 'profile') return PROFILE_ID
  if (collection === 'milestones') return (item as MilestoneRecord).milestoneId
  return (item as LogEntry).id
}

function itemsIn(state: AppState, collection: Collection): AnyRecord[] {
  switch (collection) {
    case 'log':
      return state.log
    case 'growth':
      return state.growth
    case 'memories':
      return state.memories
    case 'milestones':
      return state.milestones
    case 'profile':
      return state.profile ? [state.profile] : []
  }
}

function withItems(state: AppState, collection: Collection, items: AnyRecord[]): AppState {
  switch (collection) {
    case 'log':
      return { ...state, log: items as LogEntry[] }
    case 'growth':
      return { ...state, growth: items as GrowthEntry[] }
    case 'memories':
      return { ...state, memories: items as Memory[] }
    case 'milestones':
      return { ...state, milestones: items as MilestoneRecord[] }
    case 'profile':
      return { ...state, profile: (items[0] as BabyProfile) ?? null }
  }
}

export function findItem(state: AppState, collection: Collection, id: string): AnyRecord | undefined {
  return itemsIn(state, collection).find((item) => idOf(collection, item) === id)
}

function toRecord(collection: Collection, item: AnyRecord): SyncRecord {
  return {
    collection,
    id: idOf(collection, item),
    updatedAt: item.updatedAt ?? EPOCH,
    deletedAt: item.deletedAt,
    // Tombstones keep their payload so a device that has never seen the record
    // still stores something recognisable rather than a bare id.
    data: item,
  }
}

/** Every record in the state, as sync records — used to seed a new shared log */
export function allRecords(state: AppState): SyncRecord[] {
  return COLLECTIONS.flatMap((collection) =>
    itemsIn(state, collection).map((item) => toRecord(collection, item)),
  )
}

export function allRecordKeys(state: AppState): string[] {
  return allRecords(state).map((record) => recordKey(record.collection, record.id))
}

/** The records behind the given pending keys, skipping any that have gone */
export function recordsForKeys(state: AppState, keys: string[]): SyncRecord[] {
  const records: SyncRecord[] = []
  for (const key of keys) {
    const parsed = parseRecordKey(key)
    if (!parsed) continue
    const item = findItem(state, parsed.collection, parsed.id)
    if (item) records.push(toRecord(parsed.collection, item))
  }
  return records
}

/**
 * Record a change made on this device: stamp it, put it in place, and queue it
 * for the next push.
 */
export function applyLocalChange(
  state: AppState,
  collection: Collection,
  item: AnyRecord,
  now = new Date(),
): AppState {
  const stamped = { ...item, updatedAt: now.toISOString() } as AnyRecord
  const id = idOf(collection, stamped)
  const items = itemsIn(state, collection)
  const index = items.findIndex((existing) => idOf(collection, existing) === id)
  const next = index === -1 ? [...items, stamped] : items.map((e, i) => (i === index ? stamped : e))
  return queueKey(withItems(state, collection, next), recordKey(collection, id))
}

/** Delete on this device: keep a tombstone so the delete reaches the other phone */
export function applyLocalDelete(
  state: AppState,
  collection: Collection,
  id: string,
  now = new Date(),
): AppState {
  const item = findItem(state, collection, id)
  if (!item || item.deletedAt) return state
  const iso = now.toISOString()
  const items = itemsIn(state, collection).map((existing) =>
    idOf(collection, existing) === id ? { ...existing, updatedAt: iso, deletedAt: iso } : existing,
  )
  return queueKey(withItems(state, collection, items), recordKey(collection, id))
}

function queueKey(state: AppState, key: string): AppState {
  if (state.sync.pending.includes(key)) return state
  return { ...state, sync: { ...state.sync, pending: [...state.sync.pending, key] } }
}

/**
 * Merge records that came back from the server. Last write wins on `updatedAt`;
 * a tie keeps what this device already has, so a merge never flip-flops.
 */
export function applyRemoteRecords(state: AppState, records: SyncRecord[]): AppState {
  let next = state
  for (const record of records) {
    if (!COLLECTIONS.includes(record.collection)) continue
    const items = itemsIn(next, record.collection)
    const index = items.findIndex((item) => idOf(record.collection, item) === record.id)
    const local = index === -1 ? undefined : items[index]
    if (local && (local.updatedAt ?? EPOCH) >= record.updatedAt) continue

    const incoming = {
      ...(typeof record.data === 'object' && record.data !== null ? record.data : local ?? {}),
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    } as AnyRecord
    const merged = index === -1 ? [...items, incoming] : items.map((e, i) => (i === index ? incoming : e))
    next = withItems(next, record.collection, merged)
  }
  return next
}

/** The state the screens see: tombstones filtered out */
export function visibleState(state: AppState): AppState {
  return {
    ...state,
    profile: state.profile?.deletedAt ? null : state.profile,
    log: state.log.filter((e) => !e.deletedAt),
    growth: state.growth.filter((e) => !e.deletedAt),
    memories: state.memories.filter((e) => !e.deletedAt),
    milestones: state.milestones.filter((m) => !m.deletedAt),
  }
}

/* ---------- Family codes ---------- */

const ID_LENGTH = 10
const SECRET_LENGTH = 20
const CODE_LENGTH = ID_LENGTH + SECRET_LENGTH

/** "A1B2C-3D4E5-…" — grouped so it can be read out loud or typed by hand */
export function formatFamilyCode(householdId: string, secret: string): string {
  const raw = `${householdId}${secret}`.toUpperCase()
  return (raw.match(/.{1,5}/g) ?? []).join('-')
}

/**
 * Read a family code back, forgiving the ways people retype one: spaces,
 * missing dashes, lower case, and the letters that look like digits.
 */
export function parseFamilyCode(input: string): { householdId: string; secret: string } | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
  if (cleaned.length !== CODE_LENGTH) return null
  return { householdId: cleaned.slice(0, ID_LENGTH), secret: cleaned.slice(ID_LENGTH) }
}
