export type Sex = 'female' | 'male'

export interface BabyProfile {
  name: string
  /** ISO date, YYYY-MM-DD */
  birthDate: string
  sex: Sex
  /** Optional ISO due date; enables adjusted age for babies born early */
  dueDate?: string
}

export type MilestoneCategory = 'social' | 'language' | 'cognitive' | 'motor'

/** A milestone the baby has achieved, keyed by the static dataset id */
export interface MilestoneRecord {
  milestoneId: string
  /** ISO date it was achieved */
  achievedOn: string
}

export interface GrowthEntry {
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

export interface FeedEntry {
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

export interface SleepEntry {
  id: string
  type: 'sleep'
  /** ISO datetime the sleep started */
  time: string
  /** ISO datetime the sleep ended; undefined while still sleeping */
  endTime?: string
  note?: string
}

export interface NappyEntry {
  id: string
  type: 'nappy'
  /** ISO datetime */
  time: string
  kind: NappyKind
  note?: string
}

/** A pumping session — millilitres expressed from each breast */
export interface PumpEntry {
  id: string
  type: 'pump'
  /** ISO datetime the session started */
  time: string
  leftMl?: number
  rightMl?: number
  /** How long the session took, in minutes */
  durationMinutes?: number
  note?: string
}

export type LogEntry = FeedEntry | SleepEntry | NappyEntry | PumpEntry
export type LogEntryType = LogEntry['type']

export interface Memory {
  id: string
  /** ISO date */
  date: string
  title: string
  note?: string
  tag?: string
}

export interface AppState {
  schemaVersion: number
  profile: BabyProfile | null
  milestones: MilestoneRecord[]
  growth: GrowthEntry[]
  log: LogEntry[]
  memories: Memory[]
}
