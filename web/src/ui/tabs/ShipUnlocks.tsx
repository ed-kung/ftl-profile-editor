import type { GameData } from '../../lib/data/GameData'
import type { Achievement } from '../../lib/data/achievements'
import type { Difficulty, Profile } from '../../lib/profile/types'
import { findAchievement, withoutAchievement } from '../../lib/profile/types'
import { DifficultyCycle, EmptySlot, UnlockToggle } from '../IconCycleButton'

/**
 * Ship unlocks and the achievements that unlock Type-B layouts.
 *
 * A port of net.blerf.ftl.ui.ProfileShipUnlockPanel. Type-B has no unlock flag
 * of its own: the game grants it once two of that ship's three achievements are
 * earned, so it shows as a read-only slot here too.
 *
 * Quest and victory achievements live on the Ship Stats tab, matching how the
 * Swing panel splits them.
 */

interface Props {
  data: GameData
  profile: Profile
  onChange: (profile: Profile) => void
}

export function ShipUnlocks({ data, profile, onChange }: Props) {
  const allowHard = profile.fileFormat === 9

  const setUnlock = (
    baseId: string,
    field: 'unlockedA' | 'unlockedC',
    value: boolean,
  ) => {
    const existing = profile.shipUnlocks.find((a) => a.shipId === baseId)

    onChange({
      ...profile,
      shipUnlocks: existing
        ? profile.shipUnlocks.map((avail) =>
            avail.shipId === baseId ? { ...avail, [field]: value } : avail,
          )
        : [
            ...profile.shipUnlocks,
            {
              shipId: baseId,
              unlockedA: field === 'unlockedA' ? value : false,
              unlockedC: field === 'unlockedC' ? value : false,
            },
          ],
    })
  }

  const setAchievement = (achievementId: string, value: Difficulty | null) => {
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

  /** The achievements that unlock Type-B, excluding quest and victory ones. */
  const unlockAchievements = (baseId: string): Achievement[] =>
    data
      .getShipAchievements(data.getPlayerShipVariant(baseId, 0))
      .filter((ach) => !ach.victory && !ach.quest)

  const unlockAllShips = () => {
    const baseIds = data.getPlayerShipBaseIds()
    const byId = new Map(profile.shipUnlocks.map((a) => [a.shipId, a]))

    for (const baseId of baseIds) {
      const hasTypeC = data.getPlayerShipVariant(baseId, 2) !== null
      const existing = byId.get(baseId)

      byId.set(baseId, {
        shipId: baseId,
        unlockedA: true,
        unlockedC: hasTypeC ? true : (existing?.unlockedC ?? false),
      })
    }

    onChange({ ...profile, shipUnlocks: [...byId.values()] })
  }

  const unlockAllShipAchievements = () => {
    let achievements = profile.achievements

    for (const baseId of data.getPlayerShipBaseIds()) {
      for (const ach of unlockAchievements(baseId)) {
        if (!findAchievement(achievements, ach.id)) {
          achievements = [
            ...achievements,
            { achievementId: ach.id, difficulty: 'EASY' as Difficulty },
          ]
        }
      }
    }

    onChange({ ...profile, achievements })
  }

  return (
    <>
      <section className="panel">
        <h2>Ship Unlocks</h2>
        <p className="panel-note">
          Click an icon to lock or unlock that layout. Type-B unlocks itself once
          two of the ship's achievements below are earned.
        </p>

        <div className="grid-ships">
          {data.getPlayerShipBaseIds().map((baseId) => {
            const variantA = data.getPlayerShipVariant(baseId, 0)
            if (!variantA) return null

            const variantB = data.getPlayerShipVariant(baseId, 1)
            const variantC = data.getPlayerShipVariant(baseId, 2)
            const avail = profile.shipUnlocks.find((a) => a.shipId === baseId)

            const earnedCount = unlockAchievements(baseId).filter((ach) =>
              findAchievement(profile.achievements, ach.id),
            ).length

            return (
              <div className="ship-card" key={baseId}>
                <h3>{variantA.shipClass ?? baseId}</h3>
                <div className="icon-row">
                  <UnlockToggle
                    iconUrl={data.getShipIconUrl(variantA)}
                    label={`Type-A: ${variantA.name ?? variantA.id}`}
                    caption="Type-A"
                    unlocked={avail?.unlockedA ?? false}
                    onChange={(v) => setUnlock(baseId, 'unlockedA', v)}
                  />

                  {variantB ? (
                    <span className="icon-slot">
                      <span
                        className={`icon-button ${
                          earnedCount >= 2 ? 'is-unlocked' : 'is-locked'
                        }`}
                        title={`Type-B: ${variantB.name ?? variantB.id} — unlocked by earning two of this ship's achievements (${earnedCount}/2)`}
                      >
                        <img
                          src={data.getShipIconUrl(variantB) ?? undefined}
                          alt=""
                          draggable={false}
                        />
                      </span>
                      <span className="icon-caption">
                        Type-B ({earnedCount}/2)
                      </span>
                    </span>
                  ) : (
                    <EmptySlot label="Type-B: none" caption="Type-B" />
                  )}

                  {variantC ? (
                    <UnlockToggle
                      iconUrl={data.getShipIconUrl(variantC)}
                      label={`Type-C: ${variantC.name ?? variantC.id}`}
                      caption="Type-C"
                      unlocked={avail?.unlockedC ?? false}
                      onChange={(v) => setUnlock(baseId, 'unlockedC', v)}
                    />
                  ) : (
                    <EmptySlot label="Type-C: none" caption="Type-C" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <p style={{ marginBottom: 0 }}>
          <button type="button" onClick={unlockAllShips}>
            Unlock all ships
          </button>
        </p>
      </section>

      <section className="panel">
        <h2>Ship Achievements</h2>
        <p className="panel-note">
          Click to cycle the difficulty it was earned on; right-click or
          shift-click to go back. Two per ship unlock its Type-B layout.
        </p>

        <div className="grid-ships">
          {data.getPlayerShipBaseIds().map((baseId) => {
            const variantA = data.getPlayerShipVariant(baseId, 0)
            const achs = unlockAchievements(baseId)
            if (!variantA || achs.length === 0) return null

            return (
              <div className="ship-card" key={baseId}>
                <h3>{variantA.shipClass ?? baseId}</h3>
                <div className="icon-row">
                  {achs.map((ach) => (
                    <DifficultyCycle
                      key={ach.id}
                      iconUrl={data.getAchievementIconUrl(ach)}
                      label={ach.name ?? ach.id}
                      title={describe(ach)}
                      value={
                        findAchievement(profile.achievements, ach.id)
                          ?.difficulty ?? null
                      }
                      allowHard={allowHard}
                      onChange={(v) => setAchievement(ach.id, v)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <p style={{ marginBottom: 0 }}>
          <button type="button" onClick={unlockAllShipAchievements}>
            Unlock all ship achievements
          </button>
        </p>
      </section>
    </>
  )
}

/** Tooltip text: the achievement's name and its single-line description. */
export function describe(ach: Achievement): string {
  const name = ach.name ?? ach.id
  const desc = ach.description?.replace(/(\r\n|\r|\n)+/g, ' ')
  return desc ? `${name} — ${desc}` : name
}
