export type Sex = 'female' | 'male'

/**
 * Sync bookkeeping carried by every record that syncs between devices.
 * `updatedAt` is the last-write-wins key; a deleted record is kept as a
 * tombstone (`deletedAt` set) so the delete reaches the other phone too.
 * Both are stamped by the app state provider, never by callers.
 */
export interface SyncMeta {
  updatedAt?: string
  deletedAt?: string
}

export interface BabyProfile extends SyncMeta {
  name: string
  /** ISO date, YYYY-MM-DD */
  birthDate: string
  sex: Sex
  /** Optional ISO due date; enables adjusted age for babies born early */
  dueDate?: string
}

export type MilestoneCategory = 'social' | 'language' | 'cognitive' | 'motor'

/** A milestone the baby has achieved, keyed by the static dataset id */
export interface MilestoneRecord extends SyncMeta {
  milestoneId: string
  /** ISO date it was achieved */
  achievedOn: string
}

export interface GrowthEntry extends SyncMeta {
  id: string
  /** ISO date of the measurement */
  date: string
  weightKg?: number
  lengthCm?: number
  headCm?: number
  note?: string
}

/** How the milk (or food) got in */
export type FeedKind = 'nursing' | 'bottle' | 'solids'
export type BreastSide = 'left' | 'right'
/** What was in the bottle */
export type BottleContent = 'formula' | 'expressed' | 'mixed'
export type NappyKind = 'wet' | 'poo' | 'mixed'

export interface FeedEntry extends SyncMeta {
  id: string
  type: 'feed'
  /** ISO datetime the feed started */
  time: string
  kind: FeedKind
  /** Nursing: minutes banked on each side (the live side is added on top while running) */
  leftMinutes?: number
  rightMinutes?: number
  /** Nursing: side currently being timed — set only while the timer runs */
  activeSide?: BreastSide
  /** Nursing: ISO datetime the current side started, paired with `activeSide` */
  sideStartedAt?: string
  /** Bottle: what was in it */
  contents?: BottleContent
  /** Bottle: millilitres taken */
  amountMl?: number
  note?: string
}

export interface SleepEntry extends SyncMeta {
  id: string
  type: 'sleep'
  /** ISO datetime the sleep started */
  time: string
  /** ISO datetime the sleep ended; undefined while still sleeping */
  endTime?: string
  note?: string
}

export interface NappyEntry extends SyncMeta {
  id: string
  type: 'nappy'
  /** ISO datetime */
  time: string
  kind: NappyKind
  note?: string
}

/** A pumping session — millilitres expressed from each breast */
export interface PumpEntry extends SyncMeta {
  id: string
  type: 'pump'
  /** ISO datetime the session started */
  time: string
  leftMl?: number
  rightMl?: number
  /** Combined amount, for sessions pumped into one bottle with no per-side split */
  totalMl?: number
  /** How long the session took, in minutes */
  durationMinutes?: number
  note?: string
}

export type LogEntry = FeedEntry | SleepEntry | NappyEntry | PumpEntry
export type LogEntryType = LogEntry['type']

export interface Memory extends SyncMeta {
  id: string
  /** ISO date */
  date: string
  title: string
  note?: string
  tag?: string
}

/**
 * Everything this device needs to sync with the family's log. The secret is
 * the half of the family code that proves this device is allowed in, so it
 * stays on the device and is never itself synced.
 */
export interface SyncSettings {
  /** Base URL of the deployed sync Worker */
  serverUrl?: string
  householdId?: string
  secret?: string
  /** Highest server change number this device has seen */
  cursor: number
  /** "collection:id" keys changed here and not yet pushed */
  pending: string[]
  lastSyncedAt?: string
  lastError?: string
}

export interface AppState {
  schemaVersion: number
  profile: BabyProfile | null
  milestones: MilestoneRecord[]
  growth: GrowthEntry[]
  log: LogEntry[]
  memories: Memory[]
  sync: SyncSettings
}
