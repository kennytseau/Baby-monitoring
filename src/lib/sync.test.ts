import { describe, expect, it } from 'vitest'
import {
  allRecordKeys,
  applyLocalChange,
  applyLocalDelete,
  applyRemoteRecords,
  formatFamilyCode,
  parseFamilyCode,
  recordsForKeys,
  visibleState,
} from './sync'
import type { SyncRecord } from './sync'
import { emptyState } from './storage'
import type { AppState, LogEntry } from './types'

const T1 = '2026-09-06T08:00:00.000Z'
const T2 = '2026-09-06T09:00:00.000Z'
const T3 = '2026-09-06T10:00:00.000Z'

function feed(id: string, amountMl: number, updatedAt: string): LogEntry {
  return { id, type: 'feed', kind: 'bottle', contents: 'formula', amountMl, time: T1, updatedAt }
}

function stateWith(entries: LogEntry[]): AppState {
  return { ...emptyState(), log: entries }
}

/** The millilitres on a bottle feed, once we know the entry is one */
function amountOf(state: AppState, id: string): number | undefined {
  const entry = state.log.find((e) => e.id === id)
  return entry?.type === 'feed' ? entry.amountMl : undefined
}

describe('local changes', () => {
  it('stamps a change and queues it for the next push', () => {
    const next = applyLocalChange(stateWith([]), 'log', feed('a', 90, T1), new Date(T2))
    expect(next.log[0].updatedAt).toBe(T2)
    expect(next.sync.pending).toEqual(['log:a'])
  })

  it('queues a key once, however many times the record is edited', () => {
    let s = applyLocalChange(stateWith([]), 'log', feed('a', 90, T1), new Date(T1))
    s = applyLocalChange(s, 'log', feed('a', 120, T1), new Date(T2))
    expect(s.log).toHaveLength(1)
    expect(amountOf(s, 'a')).toBe(120)
    expect(s.sync.pending).toEqual(['log:a'])
  })

  it('deletes by tombstone so the delete can travel', () => {
    const next = applyLocalDelete(stateWith([feed('a', 90, T1)]), 'log', 'a', new Date(T2))
    expect(next.log[0].deletedAt).toBe(T2)
    expect(next.sync.pending).toEqual(['log:a'])
    expect(visibleState(next).log).toEqual([])
  })

  it('keys the profile and milestones on their own identity', () => {
    let s = applyLocalChange(emptyState(), 'profile', {
      name: 'Mia',
      birthDate: '2026-06-20',
      sex: 'female',
    })
    s = applyLocalChange(s, 'milestones', { milestoneId: 'm2-social-smile', achievedOn: '2026-08-01' })
    expect(allRecordKeys(s).sort()).toEqual(['milestones:m2-social-smile', 'profile:profile'])
  })
})

describe('applyRemoteRecords', () => {
  const remote = (id: string, updatedAt: string, data: unknown, deletedAt?: string): SyncRecord => ({
    collection: 'log',
    id,
    updatedAt,
    deletedAt,
    data,
  })

  it('takes a newer remote edit', () => {
    const local = stateWith([feed('a', 90, T1)])
    const merged = applyRemoteRecords(local, [remote('a', T2, feed('a', 150, T2))])
    expect(amountOf(merged, 'a')).toBe(150)
  })

  it('keeps a newer local edit', () => {
    const local = stateWith([feed('a', 150, T3)])
    const merged = applyRemoteRecords(local, [remote('a', T2, feed('a', 90, T2))])
    expect(amountOf(merged, 'a')).toBe(150)
  })

  it('keeps the local record when the timestamps tie, so merging settles', () => {
    const local = stateWith([feed('a', 150, T2)])
    const once = applyRemoteRecords(local, [remote('a', T2, feed('a', 90, T2))])
    const twice = applyRemoteRecords(once, [remote('a', T2, feed('a', 90, T2))])
    expect(amountOf(once, 'a')).toBe(150)
    expect(twice).toEqual(once)
  })

  it('adds records it has never seen and applies remote deletes', () => {
    const local = stateWith([feed('a', 90, T1)])
    const merged = applyRemoteRecords(local, [
      remote('b', T2, feed('b', 60, T2)),
      remote('a', T3, feed('a', 90, T3), T3),
    ])
    expect(merged.log).toHaveLength(2)
    expect(visibleState(merged).log.map((e) => e.id)).toEqual(['b'])
  })

  it('does not queue merged records for pushing back', () => {
    const merged = applyRemoteRecords(stateWith([]), [remote('b', T2, feed('b', 60, T2))])
    expect(merged.sync.pending).toEqual([])
  })

  it('is idempotent when the same batch arrives twice', () => {
    const first = applyRemoteRecords(stateWith([]), [remote('b', T2, feed('b', 60, T2))])
    const second = applyRemoteRecords(first, [remote('b', T2, feed('b', 60, T2))])
    expect(second).toEqual(first)
  })
})

describe('recordsForKeys', () => {
  it('collects only the queued records, tombstones included', () => {
    const state = applyLocalDelete(stateWith([feed('a', 90, T1), feed('b', 60, T1)]), 'log', 'b', new Date(T2))
    const records = recordsForKeys(state, state.sync.pending)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ collection: 'log', id: 'b', deletedAt: T2 })
  })

  it('skips keys whose record has gone', () => {
    expect(recordsForKeys(stateWith([]), ['log:missing', 'nonsense'])).toEqual([])
  })
})

describe('family codes', () => {
  it('groups a code for reading out loud and reads it back', () => {
    const code = formatFamilyCode('0123456789', 'ABCDEFGHJKMNPQRSTVWX')
    expect(code).toBe('01234-56789-ABCDE-FGHJK-MNPQR-STVWX')
    expect(parseFamilyCode(code)).toEqual({
      householdId: '0123456789',
      secret: 'ABCDEFGHJKMNPQRSTVWX',
    })
  })

  it('forgives lower case, spaces, missing dashes and look-alike letters', () => {
    const parsed = parseFamilyCode(' 0l234 56789abcdefghjkmnpqrstvwx ')
    expect(parsed).toEqual({ householdId: '0123456789', secret: 'ABCDEFGHJKMNPQRSTVWX' })
  })

  it('rejects a code of the wrong length', () => {
    expect(parseFamilyCode('too-short')).toBeNull()
    expect(parseFamilyCode('')).toBeNull()
  })
})
