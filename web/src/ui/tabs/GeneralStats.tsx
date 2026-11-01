import {
  CREW_STAT_TYPES,
  SESSION_RECORD_TYPES,
  STAT_LABELS,
  TOTAL_STAT_TYPES,
  type CrewStatType,
  type IntStatType,
  type Profile,
  type Score,
} from '../../lib/profile/types'
import { ScoreEditor, blankScore, toInt } from '../ScoreEditor'

/**
 * Top scores and the overall records.
 *
 * A port of net.blerf.ftl.ui.ProfileGeneralStatsPanel. FTL keeps five top
 * scores; the editor shows five slots whether or not they are all filled.
 */

const MAX_SCORE_PANELS = 5

interface Props {
  profile: Profile
  onChange: (profile: Profile) => void
}

export function GeneralStats({ profile, onChange }: Props) {
  const advancedEdition = profile.fileFormat === 9
  const { topScores, intRecords, crewRecords } = profile.stats

  const setTopScores = (scores: Score[]) =>
    onChange({ ...profile, stats: { ...profile.stats, topScores: scores } })

  const setIntRecord = (type: IntStatType, value: number) =>
    onChange({
      ...profile,
      stats: {
        ...profile.stats,
        intRecords: { ...intRecords, [type]: value },
      },
    })

  const setCrewRecord = (
    type: CrewStatType,
    fields: Partial<(typeof crewRecords)[CrewStatType]>,
  ) =>
    onChange({
      ...profile,
      stats: {
        ...profile.stats,
        crewRecords: {
          ...crewRecords,
          [type]: { ...crewRecords[type], ...fields },
        },
      },
    })

  const slots = Array.from({ length: Math.max(MAX_SCORE_PANELS, topScores.length) })

  return (
    <>
      <section className="panel">
        <h2>Top Scores</h2>
        <p className="panel-note">
          The high-score table on FTL's main menu.
        </p>
        {slots.map((_, i) => (
          <ScoreEditor
            key={i}
            index={i + 1}
            score={topScores[i] ?? null}
            advancedEdition={advancedEdition}
            onChange={(score) =>
              setTopScores(topScores.map((s, j) => (j === i ? score : s)))
            }
            onRemove={() => setTopScores(topScores.filter((_, j) => j !== i))}
            onAdd={() =>
              setTopScores([
                ...topScores,
                blankScore('PLAYER_SHIP_HARD', advancedEdition),
              ])
            }
          />
        ))}
      </section>

      <div className="two-column">
        <section className="panel">
          <h2>Session Records</h2>
          <p className="panel-note">The best single run.</p>
          <table className="records">
            <tbody>
              {SESSION_RECORD_TYPES.map((type) => (
                <tr key={type}>
                  <th scope="row">{STAT_LABELS[type]}</th>
                  <td>
                    <input
                      type="number"
                      value={intRecords[type]}
                      aria-label={STAT_LABELS[type]}
                      onChange={(e) => setIntRecord(type, toInt(e.target.value))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Total Stats</h2>
          <p className="panel-note">Accumulated across every run.</p>
          <table className="records">
            <tbody>
              {TOTAL_STAT_TYPES.map((type) => (
                <tr key={type}>
                  <th scope="row">{STAT_LABELS[type]}</th>
                  <td>
                    <input
                      type="number"
                      value={intRecords[type]}
                      aria-label={STAT_LABELS[type]}
                      onChange={(e) => setIntRecord(type, toInt(e.target.value))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel">
        <h2>Crew Records</h2>
        <p className="panel-note">
          The crew member who holds each record, and the value they set.
        </p>
        <table className="records">
          <thead>
            <tr>
              <th>Record</th>
              <th>Value</th>
              <th>Name</th>
              <th>Race</th>
              <th>Male</th>
            </tr>
          </thead>
          <tbody>
            {CREW_STAT_TYPES.map((type) => {
              const rec = crewRecords[type]
              return (
                <tr key={type}>
                  <th scope="row">{STAT_LABELS[type]}</th>
                  <td>
                    <input
                      type="number"
                      value={rec.value}
                      aria-label={`${STAT_LABELS[type]} value`}
                      onChange={(e) =>
                        setCrewRecord(type, { value: toInt(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      size={14}
                      value={rec.name}
                      aria-label={`${STAT_LABELS[type]} name`}
                      onChange={(e) => setCrewRecord(type, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      size={10}
                      value={rec.race}
                      aria-label={`${STAT_LABELS[type]} race`}
                      onChange={(e) => setCrewRecord(type, { race: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={rec.male}
                      aria-label={`${STAT_LABELS[type]} male`}
                      onChange={(e) =>
                        setCrewRecord(type, { male: e.target.checked })
                      }
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </>
  )
}
