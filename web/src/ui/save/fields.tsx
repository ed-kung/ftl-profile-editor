import { useId } from 'react'

import { toInt } from '../ScoreEditor'

/** Form controls shared by the saved-game tabs. */

type FieldValue = number | boolean | string

/** One row of a form: a property of T, and what to call it. */
export type FieldRow<T> = readonly [key: keyof T & string, label: string]

interface ValueInputProps {
  id?: string
  label?: string
  value: FieldValue
  disabled?: boolean
  onChange: (value: FieldValue) => void
}

/** The right control for a value, going by its type. */
export function ValueInput({ id, label, value, disabled, onChange }: ValueInputProps) {
  if (typeof value === 'boolean') {
    return (
      <input
        id={id}
        type="checkbox"
        aria-label={label}
        disabled={disabled}
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
    )
  }

  if (typeof value === 'number') {
    return (
      <input
        id={id}
        type="number"
        aria-label={label}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(toInt(e.target.value))}
      />
    )
  }

  return (
    <input
      id={id}
      type="text"
      aria-label={label}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

interface FieldGridProps<T> {
  value: T
  rows: ReadonlyArray<FieldRow<T>>
  onChange: (value: T) => void
}

/** A form over the listed properties of an object. */
export function FieldGrid<T extends object>({ value, rows, onChange }: FieldGridProps<T>) {
  const baseId = useId()

  return (
    <div className="field-grid">
      {rows.map(([key, label]) => {
        const id = `${baseId}-${key}`
        return (
          <FieldPair key={key} id={id} label={label}>
            <ValueInput
              id={id}
              value={value[key] as FieldValue}
              onChange={(next) => onChange({ ...value, [key]: next })}
            />
          </FieldPair>
        )
      })}
    </div>
  )
}

interface FieldPairProps {
  id: string
  label: string
  children: React.ReactNode
}

function FieldPair({ id, label, children }: FieldPairProps) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div>{children}</div>
    </>
  )
}

interface IdSelectProps {
  label: string
  value: string
  /** Choices as [id, description]. */
  options: Array<{ id: string; title: string | null }>
  onChange: (id: string) => void
}

/**
 * A choice of game item.
 *
 * The current value is always offered, even if the game data doesn't know it,
 * so a modded save's items can't be swapped by simply opening the list.
 */
export function IdSelect({ label, value, options, onChange }: IdSelectProps) {
  const known = options.some((option) => option.id === value)

  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {!known && <option value={value}>{value} (not in game data)</option>}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.title ? `${option.title} (${option.id})` : option.id}
        </option>
      ))}
    </select>
  )
}
