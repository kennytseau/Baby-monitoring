import { describe, expect, it } from 'vitest'
import {
  commitNursingSide,
  currentWakeMinutes,
  findOpenNursing,
  finishNursing,
  isNursingInProgress,
  isNursingPaused,
  isNursingRunning,
  pauseNursing,
  resumeNursing,
  dayTotals,
  nursingMinutes,
  sideMinutes,
  sleepMinutes,
  startNursingSession,
  summarizeEntry,
  switchNursingSide,
  wakeWindows,
} from './log'
import type { FeedEntry, LogEntry, NappyEntry, PumpEntry, SleepEntry } from './types'

const NOW = new Date('2026-09-06T12:00:00Z')
const at = (hhmm: string) => `2026-09-06T${hhmm}:00.000Z`

function nursing(partial: Partial<FeedEntry> & { id: string; time: string }): FeedEntry {
  return { type: 'feed', kind: 'nursing', ...partial }
}
function sleep(id: string, time: string, endTime?: string): SleepEntry {
  return { id, type: 'sleep', time, endTime }
}
function nappy(id: string, time: string, kind: NappyEntry['kind']): NappyEntry {
  return { id, type: 'nappy', time, kind }
}

describe('nursing durations', () => {
  it('adds the banked minutes on both sides', () => {
    const feed = nursing({ id: 'f1', time: at('08:00'), leftMinutes: 12, rightMinutes: 8 })
    expect(nursingMinutes(feed, NOW)).toBe(20)
    expect(sideMinutes(feed, 'left', NOW)).toBe(12)
  })

  it('counts the running side up to now', () => {
    const feed = nursing({
      id: 'f2',
      time: at('11:45'),
      leftMinutes: 10,
      activeSide: 'right',
      sideStartedAt: at('11:55'),
    })
    expect(sideMinutes(feed, 'right', NOW)).toBe(5)
    expect(nursingMinutes(feed, NOW)).toBe(15)
  })

  it('ignores a stale start time in the future', () => {
    const feed = nursing({ id: 'f3', time: at('12:30'), activeSide: 'left', sideStartedAt: at('12:30') })
    expect(nursingMinutes(feed, NOW)).toBe(0)
  })
})

describe('sleepMinutes', () => {
  it('measures a finished sleep', () => {
    expect(sleepMinutes(sleep('s1', at('09:00'), at('10:30')), NOW)).toBe(90)
  })

  it('counts an open sleep up to now', () => {
    expect(sleepMinutes(sleep('s2', at('11:30')), NOW)).toBe(30)
  })
})

describe('wakeWindows', () => {
  const log: LogEntry[] = [
    sleep('s1', at('07:00'), at('08:00')),
    sleep('s2', at('09:30'), at('10:30')),
    sleep('s3', at('11:45')),
  ]

  it('measures the gap between one sleep ending and the next starting', () => {
    const windows = wakeWindows(log, NOW)
    expect(windows.map((w) => w.minutes)).toEqual([90, 75])
    expect(windows.every((w) => !w.open)).toBe(true)
  })

  it('leaves the last window open while the baby is awake', () => {
    const windows = wakeWindows([sleep('s1', at('07:00'), at('08:00'))], NOW)
    expect(windows).toHaveLength(1)
    expect(windows[0]).toMatchObject({ open: true, minutes: 240 })
  })

  it('reports how long she has been awake, and nothing while she sleeps', () => {
    expect(currentWakeMinutes([sleep('s1', at('07:00'), at('11:00'))], NOW)).toBe(60)
    expect(currentWakeMinutes(log, NOW)).toBeNull()
    expect(currentWakeMinutes([], NOW)).toBeNull()
  })
})

describe('dayTotals', () => {
  const entries: LogEntry[] = [
    nursing({ id: 'f1', time: at('06:00'), leftMinutes: 14, rightMinutes: 6 }),
    { id: 'f2', type: 'feed', kind: 'bottle', contents: 'formula', amountMl: 120, time: at('09:00') },
    { id: 'f3', type: 'feed', kind: 'bottle', contents: 'expressed', amountMl: 90, time: at('11:00') },
    { id: 'f4', type: 'feed', kind: 'solids', time: at('11:30') },
    sleep('s1', at('07:00'), at('08:00')),
    sleep('s2', at('09:30'), at('11:15')),
    nappy('n1', at('06:10'), 'wet'),
    nappy('n2', at('09:10'), 'mixed'),
    nappy('n3', at('11:10'), 'poo'),
    { id: 'p1', type: 'pump', time: at('10:00'), leftMl: 70, rightMl: 55 } as PumpEntry,
  ]

  it('rolls milk, nappies, sleep and pumping up', () => {
    const totals = dayTotals(entries, NOW)
    expect(totals).toMatchObject({
      feeds: 4,
      nursingSessions: 1,
      nursingMinutes: 20,
      leftMinutes: 14,
      rightMinutes: 6,
      bottles: 2,
      bottleMl: 210,
      formulaMl: 120,
      expressedMl: 90,
      solids: 1,
      nappyTotal: 3,
      sleeps: 2,
      sleepMinutes: 165,
      longestSleepMinutes: 105,
      pumpSessions: 1,
      pumpedLeftMl: 70,
      pumpedRightMl: 55,
      pumpedMl: 125,
    })
    expect(totals.nappies).toEqual({ wet: 1, poo: 1, mixed: 1 })
  })

  it('is all zeros for an empty day', () => {
    const totals = dayTotals([], NOW)
    expect(totals.feeds).toBe(0)
    expect(totals.pumpedMl).toBe(0)
    expect(totals.nappies).toEqual({ wet: 0, poo: 0, mixed: 0 })
  })
})

describe('nursing session timer', () => {
  it('banks the timed side when switching and stopping', () => {
    const started = startNursingSession('f1', 'left', new Date(at('11:30')))
    expect(started).toMatchObject({ activeSide: 'left', sideStartedAt: at('11:30') })

    const switched = switchNursingSide(started, 'right', new Date(at('11:42')))
    expect(switched.leftMinutes).toBe(12)
    expect(switched).toMatchObject({ activeSide: 'right', sideStartedAt: at('11:42') })

    const stopped = commitNursingSide(switched, new Date(at('11:50')))
    expect(stopped).toMatchObject({ leftMinutes: 12, rightMinutes: 8 })
    expect(stopped.activeSide).toBeUndefined()
    expect(stopped.sideStartedAt).toBeUndefined()
    expect(nursingMinutes(stopped, NOW)).toBe(20)
  })

  it('adds to a side that was already timed earlier in the session', () => {
    const feed = nursing({
      id: 'f2',
      time: at('11:00'),
      leftMinutes: 5,
      activeSide: 'left',
      sideStartedAt: at('11:50'),
    })
    expect(commitNursingSide(feed, new Date(at('11:57'))).leftMinutes).toBe(12)
  })

  it('does nothing to a session with no timer running', () => {
    const feed = nursing({ id: 'f3', time: at('11:00'), leftMinutes: 9 })
    expect(commitNursingSide(feed, NOW)).toEqual(feed)
  })
})

describe('medication', () => {
  const dose = (id: string, name: string, time: string, amount?: string): LogEntry => ({
    id,
    type: 'medication',
    time,
    name,
    amount,
  })

  it('lists the day\'s doses in the totals', () => {
    const totals = dayTotals([dose('d1', 'Paracetamol', at('06:00'), '0.7 ml')], NOW)
    expect(totals.medicines).toEqual([
      { name: 'Paracetamol', amount: '0.7 ml', time: at('06:00') },
    ])
  })

  it('reads as a timeline row', () => {
    expect(summarizeEntry(dose('d1', 'Paracetamol', at('06:00'), '0.7 ml'))).toEqual({
      title: 'Paracetamol · 0.7 ml',
      detail: '',
    })
    expect(summarizeEntry(dose('d2', 'Vitamin D', at('06:00'))).title).toBe('Vitamin D')
  })
})

describe('pausing and resuming a nursing session', () => {
  it('banks the time so far and holds the clock', () => {
    const started = startNursingSession('f1', 'left', new Date(at('10:00')))
    const paused = pauseNursing(started, new Date(at('10:12')))
    expect(paused.leftMinutes).toBe(12)
    expect(isNursingPaused(paused)).toBe(true)
    expect(isNursingRunning(paused)).toBe(false)
    expect(isNursingInProgress(paused)).toBe(true)
    // and the clock really is stopped — ten minutes later it still reads 12
    expect(nursingMinutes(paused, new Date(at('10:22')))).toBe(12)
  })

  it('carries on from where it stopped', () => {
    let feed = startNursingSession('f2', 'left', new Date(at('10:00')))
    feed = pauseNursing(feed, new Date(at('10:12')))
    feed = resumeNursing(feed, new Date(at('10:30')))
    expect(isNursingRunning(feed)).toBe(true)
    expect(feed.activeSide).toBe('left')
    // 12 banked plus 5 since resuming — the 18-minute break is not counted
    expect(nursingMinutes(feed, new Date(at('10:35')))).toBe(17)
  })

  it('survives several pauses on both sides', () => {
    let feed = startNursingSession('f3', 'left', new Date(at('10:00')))
    feed = pauseNursing(feed, new Date(at('10:10')))
    feed = resumeNursing(feed, new Date(at('10:20')))
    feed = switchNursingSide(feed, 'right', new Date(at('10:25')))
    feed = pauseNursing(feed, new Date(at('10:33')))
    feed = finishNursing(feed, new Date(at('10:40')))
    expect(feed.leftMinutes).toBe(15)
    expect(feed.rightMinutes).toBe(8)
    expect(isNursingInProgress(feed)).toBe(false)
  })

  it('finishes cleanly from paused as well as from running', () => {
    const running = startNursingSession('f4', 'right', new Date(at('11:00')))
    const finishedRunning = finishNursing(running, new Date(at('11:09')))
    expect(finishedRunning.rightMinutes).toBe(9)
    expect(isNursingInProgress(finishedRunning)).toBe(false)

    const paused = pauseNursing(startNursingSession('f5', 'left', new Date(at('11:00'))), new Date(at('11:06')))
    const finishedPaused = finishNursing(paused, new Date(at('11:30')))
    expect(finishedPaused.leftMinutes).toBe(6)
    expect(isNursingInProgress(finishedPaused)).toBe(false)
  })

  it('leaves a feed logged before pausing existed reading as finished', () => {
    const old = nursing({ id: 'old', time: at('06:00'), leftMinutes: 14, rightMinutes: 9 })
    expect(isNursingInProgress(old)).toBe(false)
    expect(isNursingPaused(old)).toBe(false)
  })

  it('finds the open session whether it is running or paused', () => {
    const running = startNursingSession('r', 'left', new Date(at('10:00')))
    expect(findOpenNursing([running])?.id).toBe('r')
    expect(findOpenNursing([pauseNursing(running, new Date(at('10:05')))])?.id).toBe('r')
    expect(findOpenNursing([finishNursing(running, new Date(at('10:05')))])).toBeUndefined()
  })
})

describe('pausing does not distort the total', () => {
  it('keeps enough precision that a pause does not move the clock', () => {
    const started = startNursingSession('p1', 'left', new Date('2026-09-07T10:00:00.000Z'))
    // Pause after 3.2 seconds — the readout should not jump to 6
    const paused = pauseNursing(started, new Date('2026-09-07T10:00:03.200Z'))
    expect(nursingMinutes(paused) * 60).toBeCloseTo(3.2, 0)
  })

  it('stays accurate across many pauses', () => {
    let feed = startNursingSession('p2', 'left', new Date('2026-09-07T10:00:00.000Z'))
    // Ten one-minute stints, each separated by a pause
    for (let i = 0; i < 10; i += 1) {
      const start = new Date(`2026-09-07T10:${String(i * 2).padStart(2, '0')}:00.000Z`)
      const stop = new Date(`2026-09-07T10:${String(i * 2 + 1).padStart(2, '0')}:00.000Z`)
      feed = { ...feed, sideStartedAt: start.toISOString() }
      feed = pauseNursing(feed, stop)
    }
    expect(nursingMinutes(feed)).toBe(10)
  })
})
