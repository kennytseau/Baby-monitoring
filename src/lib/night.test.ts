import { describe, expect, it } from 'vitest'
import { isNight } from './night'

describe('isNight', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 2, h, m)
  it('is on through the night when set to auto', () => {
    expect([at(18, 59), at(19), at(23, 30), at(3, 22), at(6, 59), at(7), at(12)].map((t) => isNight('auto', t))).toEqual([
      false, true, true, true, true, false, false,
    ])
  })
  it('does as it is told otherwise', () => {
    expect(isNight('on', at(12))).toBe(true)
    expect(isNight('off', at(3))).toBe(false)
  })
})
