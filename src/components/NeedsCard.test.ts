import { describe, expect, it } from 'vitest'
import { needLines } from './NeedsCard'
import type { Need, NeedsForecast } from '../lib/needs'

function need(kind: Need['kind'], state: Need['state'], over: Partial<Need> = {}): Need {
  return {
    kind,
    state,
    at: new Date('2026-09-11T14:00:00'),
    dueIn: -10,
    since: 120,
    usual: 110,
    shortest: 80,
    longest: 150,
    serving: kind === 'feed' ? { unit: 'ml', value: 70 } : undefined,
    approximate: false,
    ...over,
  }
}
const lines = (forecast: Partial<NeedsForecast>) =>
  needLines({ asleep: false, ...forecast }).map((line) => line.replace(/ /g, ' '))

describe('what the card says', () => {
  it('leads with what is coming and how much, then the evidence', () => {
    expect(
      lines({
        feed: need('feed', 'settled', { dueIn: 95, since: 15 }),
        nappy: need('nappy', 'settled', { dueIn: 40, since: 70 }),
      }),
    ).toEqual([
      'About 70 ml in about 1 h 35 m — Last feed 15 min ago · usually 1 h 20 m–2 h 30 m apart',
      'A change in about 40 min — Last change 1 h 10 m ago · usually 1 h 20 m–2 h 30 m apart',
    ])
  })

  it('says "about now" once the stretch has run out, and how late it is after that', () => {
    expect(lines({ feed: need('feed', 'due') })[0]).toMatch(/^About 70 ml, about now/)
    expect(lines({ feed: need('feed', 'late', { dueIn: -40 }) })[0]).toMatch(
      /^About 70 ml, due 40 min ago/,
    )
  })

  it('offers minutes at the breast to a baby who nurses', () => {
    expect(
      lines({ feed: need('feed', 'soon', { dueIn: 15, serving: { unit: 'min', value: 20 } }) })[0],
    ).toMatch(/^About 20 min nursing in about 15 min/)
  })

  it('drops the amount rather than guessing it', () => {
    expect(lines({ feed: need('feed', 'soon', { dueIn: 15, serving: undefined }) })[0]).toMatch(
      /^A feed in about 15 min/,
    )
  })

  it('does not tell you to wake a sleeping baby', () => {
    expect(lines({ asleep: true, feed: need('feed', 'late'), nappy: need('nappy', 'due') })).toEqual([
      'About 70 ml when she wakes — Last feed 2 h ago · usually 1 h 20 m–2 h 30 m apart',
      'A change when she wakes — Last change 2 h ago · usually 1 h 20 m–2 h 30 m apart',
    ])
  })
})
