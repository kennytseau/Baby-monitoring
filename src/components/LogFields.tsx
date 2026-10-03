import type { BottleContent } from '../lib/types'
import { BOTTLE_LABELS, BOTTLE_OPTIONS, type PumpMode } from '../lib/log'

/**
 * The controls the two logging surfaces share. Quick log and the daily log
 * form are laid out differently on purpose — one is a one-tap panel, the other
 * a full editable entry — but a bottle is a bottle and a dose is a dose, so
 * these are defined once rather than kept in step by hand.
 */

export function BottleContentsPicker({
  value,
  onChange,
}: {
  value: BottleContent
  onChange: (contents: BottleContent) => void
}) {
  return (
    <div className="seg" role="group" aria-label="What's in the bottle">
      {BOTTLE_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          className={value === option ? 'on' : ''}
          onClick={() => onChange(option)}
        >
          {BOTTLE_LABELS[option]}
        </button>
      ))}
    </div>
  )
}

/** What was given and how much, as it is written on the syringe */
export function MedicineFields({
  idPrefix,
  name,
  amount,
  onName,
  onAmount,
}: {
  idPrefix: string
  name: string
  amount: string
  onName: (value: string) => void
  onAmount: (value: string) => void
}) {
  return (
    <div className="field-row">
      <div className="field" style={{ flex: 2 }}>
        <label htmlFor={`${idPrefix}-medicine`}>Medicine</label>
        <input
          id={`${idPrefix}-medicine`}
          type="text"
          autoCapitalize="words"
          placeholder="Paracetamol"
          value={name}
          onChange={(e) => onName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-dose`}>Amount</label>
        <input
          id={`${idPrefix}-dose`}
          type="text"
          inputMode="decimal"
          placeholder="0.7 ml"
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
        />
      </div>
    </div>
  )
}

const PUMP_MODE_KEY = 'little-one:pump-mode'

/** The way this phone last logged pumping — one total unless sides were chosen */
export function lastPumpMode(): PumpMode {
  try {
    return localStorage.getItem(PUMP_MODE_KEY) === 'sides' ? 'sides' : 'total'
  } catch {
    return 'total'
  }
}

export function rememberPumpMode(mode: PumpMode): void {
  try {
    localStorage.setItem(PUMP_MODE_KEY, mode)
  } catch {
    // Private browsing can refuse storage; the choice then lasts the session.
  }
}

/**
 * How much was pumped and for how long. One total by default — two numbers in
 * the middle of the night — or each side, for when that is worth knowing.
 */
export function PumpFields({
  idPrefix,
  mode,
  onMode,
  left,
  right,
  total,
  minutes,
  onLeft,
  onRight,
  onTotal,
  onMinutes,
}: {
  idPrefix: string
  mode: PumpMode
  onMode: (mode: PumpMode) => void
  left: string
  right: string
  total: string
  minutes: string
  onLeft: (value: string) => void
  onRight: (value: string) => void
  onTotal: (value: string) => void
  onMinutes: (value: string) => void
}) {
  const amount = (id: string, label: string, value: string, onChange: (value: string) => void) => (
    <div className="field">
      <label htmlFor={`${idPrefix}-${id}`}>{label}</label>
      <input
        id={`${idPrefix}-${id}`}
        type="number"
        inputMode="numeric"
        min="0"
        step="5"
        placeholder={id === 'total' ? '120' : '60'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
  return (
    <>
      <div className="seg" role="group" aria-label="How to log the amount">
        {(['total', 'sides'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={mode === option ? 'on' : ''}
            aria-pressed={mode === option}
            onClick={() => onMode(option)}
          >
            {option === 'total' ? 'Total' : 'Left & right'}
          </button>
        ))}
      </div>
      <div className="field-row">
        {mode === 'total' ? (
          amount('total', 'Total (ml)', total, onTotal)
        ) : (
          <>
            {amount('left', 'Left (ml)', left, onLeft)}
            {amount('right', 'Right (ml)', right, onRight)}
          </>
        )}
        <div className="field">
          <label htmlFor={`${idPrefix}-pump-mins`}>Minutes</label>
          <input
            id={`${idPrefix}-pump-mins`}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            placeholder="20"
            value={minutes}
            onChange={(e) => onMinutes(e.target.value)}
          />
        </div>
      </div>
    </>
  )
}
