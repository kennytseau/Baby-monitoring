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

export type FeedMethod = 'breast-left' | 'breast-right' | 'bottle' | 'solids'
export type DiaperKind = 'wet' | 'dirty' | 'both'

export interface FeedEntry {
  id: string
  type: 'feed'
  /** ISO datetime */
  time: string
  method: FeedMethod
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

export interface DiaperEntry {
  id: string
  type: 'diaper'
  /** ISO datetime */
  time: string
  kind: DiaperKind
  note?: string
}

export type LogEntry = FeedEntry | SleepEntry | DiaperEntry

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
