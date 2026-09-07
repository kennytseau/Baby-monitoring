import type { DayTotals } from '../lib/log'
import { formatDuration } from '../lib/format'

/** The day's numbers: milk in, nappies out, sleep, and what was pumped */
export function DayTotalsCard({ totals }: { totals: DayTotals }) {
  const milk: string[] = []
  if (totals.formulaMl) milk.push(`Formula ${totals.formulaMl} ml`)
  if (totals.expressedMl) milk.push(`Breast milk ${totals.expressedMl} ml`)
  const otherBottleMl = totals.bottleMl - totals.formulaMl - totals.expressedMl
  if (otherBottleMl > 0) milk.push(`Bottle ${otherBottleMl} ml`)
  if (totals.nursingSessions) {
    milk.push(`Nursed ${totals.nursingSessions}× · ${formatDuration(totals.nursingMinutes)}`)
    milk.push(`L ${formatDuration(totals.leftMinutes)} · R ${formatDuration(totals.rightMinutes)}`)
  }
  if (totals.solids) milk.push(`Solids ${totals.solids}×`)

  const nappies: string[] = []
  if (totals.nappies.wet) nappies.push(`Wet ${totals.nappies.wet}`)
  if (totals.nappies.poo) nappies.push(`Poo ${totals.nappies.poo}`)
  if (totals.nappies.mixed) nappies.push(`Wet + poo ${totals.nappies.mixed}`)

  const sleep: string[] = []
  if (totals.sleeps) {
    sleep.push(formatDuration(totals.sleepMinutes))
    sleep.push(`${totals.sleeps} sleep${totals.sleeps === 1 ? '' : 's'}`)
    sleep.push(`longest ${formatDuration(totals.longestSleepMinutes)}`)
  }

  const pumped: string[] = []
  if (totals.pumpSessions) {
    pumped.push(`${totals.pumpedMl} ml`)
    pumped.push(`L ${totals.pumpedLeftMl} ml · R ${totals.pumpedRightMl} ml`)
    pumped.push(`${totals.pumpSessions} session${totals.pumpSessions === 1 ? '' : 's'}`)
  }

  const medicines = totals.medicines.map((m) => (m.amount ? `${m.name} ${m.amount}` : m.name))

  const rows: Array<[string, string[]]> = [
    ['Milk', milk],
    ['Nappies', nappies],
    ['Sleep', sleep],
    ['Pumped', pumped],
    ['Medicine', medicines],
  ]
  const filled = rows.filter(([, values]) => values.length > 0)
  if (filled.length === 0) return null

  return (
    <div className="card totals-card">
      {filled.map(([label, values]) => (
        <div className="totals-row" key={label}>
          <span className="totals-label">{label}</span>
          <span className="totals-values">
            {/* Two identical values in a day are normal — a repeat dose, say — so key on position */}
            {values.map((v, i) => (
              <span className="chip chip-neutral" key={`${label}-${i}`}>
                {v}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}
