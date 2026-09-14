import { describe, expect, it } from 'vitest'
import { needLines } from './NeedsCard'
import type { Need, NeedsForecast } from '../lib/needs'

function need(kind: Need['kind'], state: Need['state'], over: Partial<Need> = {}): Need {
  return {
    kind,
    state,
    lastAt: new Date('2026-09-11T12:00:00'),
    since: 120,
    usual: 110,
    shortest: 80,
    longest: 150,
    dueIn: -10,
    samples: 12,
    approximate: false,
    ...over,
  }
}
const lines = (forecast: Partial<NeedsForecast>) =>
  needLines({ asleep: false, ...forecast }).map((line) => line.replace(/ /g, ' '))

describe('what the card says', () => {
  it('answers the two questions with the evidence behind them', () => {
    expect(lines({ feed: need('feed', 'due'), nappy: need('nappy', 'settled', { since: 25 }) })).toEqual([
      'Probably ready for a feed — 2 h since the last one · usually 1 h 20 m–2 h 30 m',
      'Changed 25 min ago — Usually about 1 h 50 m between changes at this hour',
    ])
  })

  it('counts down while there is still time', () => {
    expect(lines({ feed: need('feed', 'soon', { dueIn: 15, since: 95 }) })[0]).toBe(
      'Feed likely in about 15 min — 1 h 35 m since the last one · usually 1 h 20 m–2 h 30 m',
    )
  })

  it('does not tell you to wake a sleeping baby', () => {
    expect(lines({ asleep: true, feed: need('feed', 'late'), nappy: need('nappy', 'due') })).toEqual([
      'Hungry when she wakes — 2 h since the last one · usually 1 h 20 m–2 h 30 m',
      'A change due when she wakes — 2 h since the last one · usually 1 h 20 m–2 h 30 m',
    ])
  })

  it('says it plainly when she is awake and past her usual stretch', () => {
    expect(lines({ feed: need('feed', 'late'), nappy: need('nappy', 'late') }).map((l) => l.split(' — ')[0])).toEqual([
      'Probably hungry',
      'Worth a nappy check',
    ])
  })
})
