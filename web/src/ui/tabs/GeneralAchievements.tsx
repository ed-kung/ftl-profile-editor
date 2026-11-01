import type { GameData } from '../../lib/data/GameData'
import {
  NEWBIE_TIP_LEVELS,
  NEWBIE_TIP_LEVEL_LABELS,
  findAchievement,
  withoutAchievement,
  type Difficulty,
  type NewbieTipLevel,
  type Profile,
} from '../../lib/profile/types'
import { DifficultyCycle } from '../IconCycleButton'
import { describe } from './ShipUnlocks'

/**
 * The achievements not tied to any ship, plus the hangar's tip level.
 *
 * A port of net.blerf.ftl.ui.ProfileGeneralAchievementsPanel. The three groups
 * are the game's own, and like the Swing panel they are taken positionally --
 * seven at a time from the order achievements.xml lists them.
 */

const GROUPS: Array<{ title: string; offset: number }> = [
  { title: 'General Progression', offset: 0 },
  { title: 'Going the Distance', offset: 7 },
  { title: 'Skill and Equipment Feats', offset: 14 },
]

const GROUP_SIZE = 7

interface Props {
  data: GameData
  profile: Profile
  onChange: (profile: Profile) => void
}

export function GeneralAchievements({ data, profile, onChange }: Props) {
  const achievements = data.getGeneralAchievements()
  const allowHard = profile.fileFormat === 9

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

  const unlockAll = () => {
    let next = profile.achievements

    for (const ach of achievements) {
      if (!findAchievement(next, ach.id)) {
        next = [...next, { achievementId: ach.id, difficulty: 'EASY' }]
      }
    }

    onChange({ ...profile, achievements: next })
  }

  // Anything past the three known groups still deserves to be editable --
  // a mod can add achievements, and silently hiding them would lose them.
  const grouped = GROUPS.map((group) => ({
    ...group,
    achs: achievements.slice(group.offset, group.offset + GROUP_SIZE),
  }))

  const extras = achievements.slice(GROUPS.length * GROUP_SIZE)
  if (extras.length > 0) {
    grouped.push({
      title: 'Other',
      offset: GROUPS.length * GROUP_SIZE,
      achs: extras,
    })
  }

  return (
    <>
      {grouped.map(
        (group) =>
          group.achs.length > 0 && (
            <section className="panel" key={group.title}>
              <h2>{group.title}</h2>
              <div className="icon-row">
                {group.achs.map((ach) => (
                  <DifficultyCycle
                    key={ach.id}
                    iconUrl={data.getAchievementIconUrl(ach)}
                    label={ach.name ?? ach.id}
                    title={describe(ach)}
                    value={
                      findAchievement(profile.achievements, ach.id)?.difficulty ??
                      null
                    }
                    allowHard={allowHard}
                    onChange={(v) => setAchievement(ach.id, v)}
                  />
                ))}
              </div>
            </section>
          ),
      )}

      <section className="panel">
        <h2>Hangar Menu</h2>
        <div className="field-grid">
          <label htmlFor="newbie-tip-level">Newbie tip level</label>
          <span>
            <select
              id="newbie-tip-level"
              value={profile.newbieTipLevel ?? ''}
              disabled={profile.fileFormat !== 9}
              onChange={(e) =>
                onChange({
                  ...profile,
                  newbieTipLevel: e.target.value as NewbieTipLevel,
                })
              }
            >
              {profile.fileFormat !== 9 && (
                <option value="">Not stored in this profile format</option>
              )}
              {NEWBIE_TIP_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {NEWBIE_TIP_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </span>
        </div>
        <p className="panel-note" style={{ margin: '10px 0 0' }}>
          Which introductory tips the hangar still has to show.
        </p>
      </section>

      <p>
        <button type="button" onClick={unlockAll}>
          Unlock all general achievements
        </button>
      </p>
    </>
  )
}
