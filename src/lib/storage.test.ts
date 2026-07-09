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
