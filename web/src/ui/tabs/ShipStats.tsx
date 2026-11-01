import { useMemo, useState } from 'react'

import type { GameData } from '../../lib/data/GameData'
import {
  DIFFICULTIES,
  findAchievement,
  withoutAchievement,
  type AchievementRecord,
  type Difficulty,
  type Profile,
  type Score,
} from '../../lib/profile/types'
import { DifficultyCycle, EmptySlot } from '../IconCycleButton'
import { ScoreEditor, blankScore } from '../ScoreEditor'

/**
 * Per-ship best scores, and the quest and victory achievements.
 *
 * A port of net.blerf.ftl.ui.ProfileShipStatsPanel. A victory record has no
 * difficulty of its own in the UI: it holds one per Type-ABC layout, and the
 * record's own difficulty is the highest of the three. Clearing all three
 * removes the record, exactly as the Swing panel does.
 */

const MAX_SCORE_PANELS = 4

interface Props {
  data: GameData
  profile: Profile
  onChange: (profile: Profile) => void
}

export function ShipStats({ data, profile, onChange }: Props) {
  const advancedEdition = profile.fileFormat === 9
  const { shipBest } = profile.stats

  // Every ship id that either the game knows about or the profile mentions.
  const shipIds = useMemo(() => {
    const ids: string[] = []

    for (const baseId of data.getPlayerShipBaseIds()) {
      for (let n = 0; n < 3; n++) {
        const variant = data.getPlayerShipVariant(baseId, n)
        if (variant) ids.push(variant.id)
      }
    }

    for (const score of shipBest) {
      if (!ids.includes(score.shipId)) ids.push(score.shipId)
    }

    return ids
  }, [data, shipBest])

  const [selectedShipId, setSelectedShipId] = useState(
    () => shipBest[0]?.shipId ?? shipIds[0] ?? '',
  )

  const selectedScores = shipBest.filter((s) => s.shipId === selectedShipId)

  /** Replaces the chosen ship's scores, leaving every other ship's alone. */
  const setSelectedScores = (scores: Score[]) => {
    const others = shipBest.filter((s) => s.shipId !== selectedShipId)
    const firstIndex = shipBest.findIndex((s) => s.shipId === selectedShipId)

    // Keep this ship's scores where they were, so an untouched profile still
    // writes back in its original order.
    const merged =
      firstIndex === -1
        ? [...others, ...scores]
        : [...others.slice(0, firstIndex), ...scores, ...others.slice(firstIndex)]

    onChange({ ...profile, stats: { ...profile.stats, shipBest: merged } })
  }

  const setQuest = (achievementId: string, value: Difficulty | null) => {
    onChange({
      ...profile,
      achievements:
        value === null
          ? withoutAchievement(profile.achievements, achievementId)
          : findAchievement(profile.achievements, achievementId)
            ? profile.achievements.map((rec) =>
                rec.achievementId === achievementId
                  ? { ...rec, difficulty: value }
                  : rec,
              )
            : [...profile.achievements, { achievementId, difficulty: value }],
    })
  }

  const setVictoryVariant = (
    achievementId: string,
    field: 'completedWithTypeA' | 'completedWithTypeB' | 'completedWithTypeC',
    value: Difficulty | null,
  ) => {
    const existing = findAchievement(profile.achievements, achievementId)

    const variants = {
      completedWithTypeA: existing?.completedWithTypeA ?? null,
      completedWithTypeB: existing?.completedWithTypeB ?? null,
      completedWithTypeC: existing?.completedWithTypeC ?? null,
      [field]: value,
    } as Pick<
      AchievementRecord,
      'completedWithTypeA' | 'completedWithTypeB' | 'completedWithTypeC'
    >

    const highest = highestDifficulty([
      variants.completedWithTypeA ?? null,
      variants.completedWithTypeB ?? null,
      variants.completedWithTypeC ?? null,
    ])

    if (highest === null) {
      // No layout has won: the record goes away entirely.
      onChange({
        ...profile,
        achievements: withoutAchievement(profile.achievements, achievementId),
      })
      return
    }

    const updated: AchievementRecord = {
      achievementId,
      difficulty: highest,
      ...variants,
    }

    onChange({
      ...profile,
      achievements: existing
        ? profile.achievements.map((rec) =>
            rec.achievementId === achievementId ? updated : rec,
          )
        : [...profile.achievements, updated],
    })
  }

  const slots = Array.from({
    length: Math.max(MAX_SCORE_PANELS, selectedScores.length),
  })

  return (
    <>
      <section className="panel">
        <h2>Ship Best</h2>
        <p className="panel-note">
          The best runs recorded for one ship, as shown on its hangar page.
        </p>

        <div className="field-grid" style={{ marginBottom: 10 }}>
          <label htmlFor="ship-best-picker">Ship</label>
          <span>
            <select
              id="ship-best-picker"
              value={selectedShipId}
              onChange={(e) => setSelectedShipId(e.target.value)}
            >
              {shipIds.map((id) => {
                const ship = data.getShip(id)
                const scored = shipBest.some((s) => s.shipId === id)
                return (
                  <option key={id} value={id}>
                    {ship?.name ? `${ship.name} (${id})` : id}
                    {scored ? ' ★' : ''}
                  </option>
                )
              })}
            </select>
          </span>
        </div>

        {selectedShipId &&
          slots.map((_, i) => (
            <ScoreEditor
              key={i}
              index={i + 1}
              score={selectedScores[i] ?? null}
              shipIdEditable={false}
              advancedEdition={advancedEdition}
              onChange={(score) =>
                setSelectedScores(
                  selectedScores.map((s, j) => (j === i ? score : s)),
                )
              }
              onRemove={() =>
                setSelectedScores(selectedScores.filter((_, j) => j !== i))
              }
              onAdd={() =>
                setSelectedScores([
                  ...selectedScores,
                  blankScore(selectedShipId, advancedEdition),
                ])
              }
            />
          ))}
      </section>

      <section className="panel">
        <h2>Quest and Victory Achievements</h2>
        <p className="panel-note">
          A victory is recorded per layout. The achievement's own difficulty is
          the highest of the three, and clearing all three removes it.
        </p>

        <div className="grid-ships">
          {data.getPlayerShipBaseIds().map((baseId) => {
            const variantA = data.getPlayerShipVariant(baseId, 0)
            if (!variantA) return null

            const variantB = data.getPlayerShipVariant(baseId, 1)
            const variantC = data.getPlayerShipVariant(baseId, 2)

            const achs = data.getShipAchievements(variantA)
            const questAch = achs.find((a) => a.quest) ?? null
            const victoryAch = achs.find((a) => a.victory) ?? null

            const victoryRec = victoryAch
              ? findAchievement(profile.achievements, victoryAch.id)
              : undefined

            return (
              <div className="ship-card" key={baseId}>
                <h3>{variantA.shipClass ?? baseId}</h3>
                <div className="icon-row">
                  {questAch ? (
                    <DifficultyCycle
                      iconUrl={data.getAchievementIconUrl(questAch)}
                      label={`Quest: ${variantA.shipClass ?? baseId}`}
                      badge="?"
                      caption="Quest"
                      value={
                        findAchievement(profile.achievements, questAch.id)
                          ?.difficulty ?? null
                      }
                      allowHard={advancedEdition}
                      onChange={(v) => setQuest(questAch.id, v)}
                    />
                  ) : (
                    <EmptySlot label="Quest: none" caption="Quest" />
                  )}

                  {victoryAch ? (
                    <DifficultyCycle
                      iconUrl={data.getAchievementIconUrl(victoryAch)}
                      label={`Victory with Type-A: ${variantA.name ?? variantA.id}`}
                      badge="A"
                      caption="Win A"
                      value={victoryRec?.completedWithTypeA ?? null}
                      allowHard={advancedEdition}
                      onChange={(v) =>
                        setVictoryVariant(victoryAch.id, 'completedWithTypeA', v)
                      }
                    />
                  ) : (
                    <EmptySlot label="Victory: none" caption="Win A" />
                  )}

                  {victoryAch && variantB ? (
                    <DifficultyCycle
                      iconUrl={data.getAchievementIconUrl(victoryAch)}
                      label={`Victory with Type-B: ${variantB.name ?? variantB.id}`}
                      badge="B"
                      caption="Win B"
                      value={victoryRec?.completedWithTypeB ?? null}
                      allowHard={advancedEdition}
                      onChange={(v) =>
                        setVictoryVariant(victoryAch.id, 'completedWithTypeB', v)
                      }
                    />
                  ) : (
                    <EmptySlot label="Victory with Type-B: N/A" caption="Win B" />
                  )}

                  {victoryAch && variantC ? (
                    <DifficultyCycle
                      iconUrl={data.getAchievementIconUrl(victoryAch)}
                      label={`Victory with Type-C: ${variantC.name ?? variantC.id}`}
                      badge="C"
                      caption="Win C"
                      value={victoryRec?.completedWithTypeC ?? null}
                      allowHard={advancedEdition}
                      onChange={(v) =>
                        setVictoryVariant(victoryAch.id, 'completedWithTypeC', v)
                      }
                    />
                  ) : (
                    <EmptySlot label="Victory with Type-C: N/A" caption="Win C" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}

/** The hardest of the given difficulties, or null if none is set. */
export function highestDifficulty(
  values: Array<Difficulty | null>,
): Difficulty | null {
  let best: Difficulty | null = null

  for (const value of values) {
    if (value === null) continue
    if (best === null || DIFFICULTIES.indexOf(value) > DIFFICULTIES.indexOf(best)) {
      best = value
    }
  }

  return best
}
