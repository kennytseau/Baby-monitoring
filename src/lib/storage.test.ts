import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, deserializeState, emptyState, exportStateJson, uid } from './storage'

describe('deserializeState', () => {
  it('returns empty state for null', () => {
    expect(deserializeState(null)).toEqual(emptyState())
  })

  it('returns empty state for corrupt JSON', () => {
    expect(deserializeState('{not json')).toEqual(emptyState())
    expect(deserializeState('42')).toEqual(emptyState())
  })

  it('round-trips a saved state', () => {
    const state = emptyState()
    state.profile = { name: 'Ada', birthDate: '2026-05-14', sex: 'female' }
    state.milestones.push({ milestoneId: 'm2-social-smile', achievedOn: '2026-06-20' })
    const restored = deserializeState(exportStateJson(state))
    expect(restored).toEqual(state)
  })

  it('migrates schema 1 feeds and diapers to the current shape', () => {
    const v1 = JSON.stringify({
      schemaVersion: 1,
      log: [
        { id: 'a', type: 'feed', time: '2026-09-01T08:00:00.000Z', method: 'breast-left' },
        { id: 'b', type: 'feed', time: '2026-09-01T11:00:00.000Z', method: 'bottle', amountMl: 120 },
        { id: 'c', type: 'feed', time: '2026-09-01T17:00:00.000Z', method: 'solids' },
        { id: 'd', type: 'diaper', time: '2026-09-01T09:00:00.000Z', kind: 'dirty' },
        { id: 'e', type: 'diaper', time: '2026-09-01T12:00:00.000Z', kind: 'both' },
        { id: 'f', type: 'sleep', time: '2026-09-01T13:00:00.000Z', endTime: '2026-09-01T14:00:00.000Z' },
      ],
    })
    const log = deserializeState(v1).log
    expect(log[0]).toMatchObject({ type: 'feed', kind: 'nursing' })
    expect(log[1]).toMatchObject({ type: 'feed', kind: 'bottle', amountMl: 120 })
    expect(log[2]).toMatchObject({ type: 'feed', kind: 'solids' })
    expect(log[3]).toMatchObject({ type: 'nappy', kind: 'poo' })
    expect(log[4]).toMatchObject({ type: 'nappy', kind: 'mixed' })
    expect(log[5]).toMatchObject({ type: 'sleep', endTime: '2026-09-01T14:00:00.000Z' })
  })

  it('leaves current-schema entries untouched', () => {
    const current = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      log: [
        { id: 'a', type: 'feed', time: '2026-09-01T08:00:00.000Z', kind: 'nursing', leftMinutes: 12 },
        { id: 'b', type: 'pump', time: '2026-09-01T10:00:00.000Z', leftMl: 60, rightMl: 40 },
      ],
    })
    const log = deserializeState(current).log
    expect(log[0]).toEqual({ id: 'a', type: 'feed', time: '2026-09-01T08:00:00.000Z', kind: 'nursing', leftMinutes: 12 })
    expect(log[1]).toEqual({ id: 'b', type: 'pump', time: '2026-09-01T10:00:00.000Z', leftMl: 60, rightMl: 40 })
  })

  it('fills in missing collections from older/partial data', () => {
    const restored = deserializeState(JSON.stringify({ schemaVersion: 1, profile: null }))
    expect(restored.growth).toEqual([])
    expect(restored.log).toEqual([])
    expect(restored.memories).toEqual([])
    expect(restored.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })
})

describe('uid', () => {
  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uid()))
    expect(ids.size).toBe(1000)
  })
})
