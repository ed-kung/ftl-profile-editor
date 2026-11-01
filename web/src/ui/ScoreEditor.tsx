import { DIFFICULTIES, type Difficulty, type Score } from '../lib/profile/types'

/**
 * One editable score row.
 *
 * A port of net.blerf.ftl.ui.ScorePanel. The ship id is editable for top
 * scores but fixed for ship-best scores, where the surrounding list is keyed
 * by it.
 */

interface Props {
  index: number
  score: Score | null
  /** Omitted for ship-best scores, which belong to a chosen ship. */
  shipIdEditable?: boolean
  /** False for fileFormat 4 profiles, which have neither HARD nor DLC. */
  advancedEdition: boolean
  onChange: (score: Score) => void
  onRemove: () => void
  onAdd: () => void
}

export function ScoreEditor({
  index,
  score,
  shipIdEditable = true,
  advancedEdition,
  onChange,
  onRemove,
  onAdd,
}: Props) {
  const difficulties = advancedEdition
    ? DIFFICULTIES
    : DIFFICULTIES.filter((d) => d !== 'HARD')

  if (!score) {
    return (
      <div className="score-row">
        <span className="score-index">{index}</span>
        <span className="score-empty">
          Empty —{' '}
          <button type="button" onClick={onAdd}>
            add a score
          </button>
        </span>
      </div>
    )
  }

  const patch = (fields: Partial<Score>) => onChange({ ...score, ...fields })

  return (
    <div className="score-row">
      <span className="score-index">{index}</span>
      <div className="score-fields">
        <label>
          Ship name
          <input
            type="text"
            value={score.shipName}
            size={14}
            onChange={(e) => patch({ shipName: e.target.value })}
          />
        </label>

        {shipIdEditable && (
          <label>
            Ship id
            <input
              type="text"
              value={score.shipId}
              size={18}
              onChange={(e) => patch({ shipId: e.target.value })}
            />
          </label>
        )}

        <label>
          Score
          <input
            type="number"
            value={score.value}
            onChange={(e) => patch({ value: toInt(e.target.value) })}
          />
        </label>

        <label>
          Sector
          <input
            type="number"
            value={score.sector}
            onChange={(e) => patch({ sector: toInt(e.target.value) })}
          />
        </label>

        <label>
          Difficulty
          <select
            value={score.difficulty}
            onChange={(e) => patch({ difficulty: e.target.value as Difficulty })}
          >
            {difficulties.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label>
          <input
            type="checkbox"
            checked={score.victory}
            onChange={(e) => patch({ victory: e.target.checked })}
          />
          Victory
        </label>

        {advancedEdition && (
          <label>
            <input
              type="checkbox"
              checked={score.dlcEnabled}
              onChange={(e) => patch({ dlcEnabled: e.target.checked })}
            />
            DLC
          </label>
        )}

        <button type="button" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  )
}

/** Clamps a number input to a signed 32-bit int, since that's what FTL stores. */
export function toInt(raw: string): number {
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return 0
  return Math.max(-2147483648, Math.min(2147483647, n))
}

export function blankScore(shipId: string, advancedEdition: boolean): Score {
  return {
    shipName: '',
    shipId,
    value: 0,
    sector: 1,
    difficulty: 'NORMAL',
    victory: false,
    dlcEnabled: advancedEdition,
  }
}
