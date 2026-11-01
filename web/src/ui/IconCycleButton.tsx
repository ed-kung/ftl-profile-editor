import type { Difficulty } from '../lib/profile/types'
import { DIFFICULTIES } from '../lib/profile/types'

/**
 * The icon buttons the profile tabs are built from.
 *
 * The Swing editor composites each state into its own BufferedImage up front
 * (ImageUtilities.createCycleButton): a darkened copy with a lock glyph for
 * locked, and one copy per difficulty with the name drawn across the bottom.
 * Here the base icon is drawn once and CSS supplies the lock and the banner,
 * so nothing has to be re-rendered when a state changes.
 */

interface IconProps {
  iconUrl: string | null
  /** The button's accessible name. */
  label: string
  /**
   * A short glyph to draw when there is no icon.
   *
   * Quest and victory achievements have no artwork in the game's data files --
   * the records are synthesised -- so the Swing editor ships its own bundled
   * images for them. These badges play the same part.
   */
  badge?: string
  title?: string
  className?: string
  disabled?: boolean
  onClick?: (e: React.MouseEvent) => void
  children?: React.ReactNode
}

function IconButton({
  iconUrl,
  label,
  badge,
  title,
  className = '',
  disabled,
  onClick,
  children,
}: IconProps) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      title={title ?? label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      onContextMenu={(e) => {
        // Right-click walks the cycle backwards; four states is too many to
        // reach by clicking forward past the one you wanted.
        if (!onClick) return
        e.preventDefault()
        onClick(e)
      }}
    >
      {iconUrl ? (
        <img src={iconUrl} alt="" draggable={false} />
      ) : badge ? (
        <span className="icon-badge" aria-hidden="true">
          {badge}
        </span>
      ) : (
        <span className="icon-placeholder">{label}</span>
      )}
      {children}
    </button>
  )
}

interface UnlockToggleProps {
  iconUrl: string | null
  label: string
  badge?: string
  title?: string
  caption?: string
  unlocked: boolean
  onChange: (unlocked: boolean) => void
}

/** A two-state lock toggle, for ship unlocks. */
export function UnlockToggle({
  iconUrl,
  label,
  badge,
  title,
  caption,
  unlocked,
  onChange,
}: UnlockToggleProps) {
  return (
    <span className="icon-slot">
      <IconButton
        iconUrl={iconUrl}
        label={label}
        badge={badge}
        title={`${title ?? label} — ${unlocked ? 'unlocked' : 'locked'}`}
        className={unlocked ? 'is-unlocked' : 'is-locked'}
        onClick={() => onChange(!unlocked)}
      />
      {caption && <span className="icon-caption">{caption}</span>}
    </span>
  )
}

interface DifficultyCycleProps {
  iconUrl: string | null
  label: string
  badge?: string
  title?: string
  caption?: string
  /** null means the achievement has not been earned. */
  value: Difficulty | null
  onChange: (value: Difficulty | null) => void
  /** Drop HARD from the cycle, as fileFormat 4 profiles cannot store it. */
  allowHard?: boolean
}

/**
 * A four-state cycle: locked, then one state per difficulty.
 *
 * Left-click advances, right-click goes back.
 */
export function DifficultyCycle({
  iconUrl,
  label,
  badge,
  title,
  caption,
  value,
  onChange,
  allowHard = true,
}: DifficultyCycleProps) {
  const cycle: Array<Difficulty | null> = [
    null,
    ...DIFFICULTIES.filter((d) => allowHard || d !== 'HARD'),
  ]

  const step = (backwards: boolean) => {
    const current = cycle.indexOf(value)
    // An unrepresentable value (HARD in an old profile) resets to locked.
    const from = current === -1 ? 0 : current
    const next = (from + (backwards ? -1 : 1) + cycle.length) % cycle.length
    onChange(cycle[next])
  }

  return (
    <span className="icon-slot">
      <IconButton
        iconUrl={iconUrl}
        label={label}
        badge={badge}
        title={`${title ?? label} — ${value ?? 'locked'}`}
        className={value === null ? 'is-locked' : `is-unlocked diff-${value}`}
        onClick={(e) => step(e.type === 'contextmenu' || e.shiftKey)}
      >
        {value !== null && <span className="difficulty-banner">{value}</span>}
      </IconButton>
      {caption && <span className="icon-caption">{caption}</span>}
    </span>
  )
}

/** A greyed-out slot, for a variant or achievement this ship doesn't have. */
export function EmptySlot({
  label,
  caption,
}: {
  label: string
  caption?: string
}) {
  return (
    <span className="icon-slot">
      <IconButton
        iconUrl={null}
        label={label}
        className="is-disabled"
        disabled
      />
      {caption && <span className="icon-caption">{caption}</span>}
    </span>
  )
}
