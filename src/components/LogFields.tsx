import type { BottleContent } from '../lib/types'
import { BOTTLE_LABELS, BOTTLE_OPTIONS } from '../lib/log'

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
