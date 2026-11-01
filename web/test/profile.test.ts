import { beforeAll, describe, expect, it } from 'vitest'

import { GameData } from '../src/lib/data/GameData'
import {
  readProfile,
  writeProfile,
  type AchievementLookup,
} from '../src/lib/profile/ProfileParser'
import type { Profile } from '../src/lib/profile/types'
import {
  MISSING_DATA_MESSAGE,
  MISSING_PROFILE_MESSAGE,
  hasGameDataFixture,
  hasProfileFixture,
  loadDataPackFixture,
  loadProfileFixture,
} from './fixtures'

/** A lookup that knows a handful of ids, for tests that need no game install. */
function stubLookup(
  achievements: Record<
    string,
    { shipId?: string | null; victory?: boolean; quest?: boolean }
  >,
): AchievementLookup {
  return {
    getAchievement(id) {
      const ach = achievements[id]
      if (!ach) return undefined
      return {
        shipId: ach.shipId ?? null,
        victory: ach.victory ?? false,
        quest: ach.quest ?? false,
      }
    },
  }
}

function emptyProfile(fileFormat: number): Profile {
  return {
    fileFormat,
    newbieTipLevel: fileFormat === 9 ? 'VETERAN' : null,
    achievements: [],
    shipUnlocks: [],
    stats: {
      topScores: [],
      shipBest: [],
      intRecords: {
        MOST_SHIPS_DEFEATED: 0,
        TOTAL_SHIPS_DEFEATED: 0,
        MOST_BEACONS_EXPLORED: 0,
        TOTAL_BEACONS_EXPLORED: 0,
        MOST_SCRAP_COLLECTED: 0,
        TOTAL_SCRAP_COLLECTED: 0,
        MOST_CREW_HIRED: 0,
        TOTAL_CREW_HIRED: 0,
        TOTAL_GAMES_PLAYED: 0,
        TOTAL_VICTORIES: 0,
      },
      crewRecords: {
        MOST_REPAIRS: { name: '', race: 'human', male: true, value: 0 },
        MOST_COMBAT_KILLS: { name: '', race: 'human', male: true, value: 0 },
        MOST_PILOTED_EVASIONS: { name: '', race: 'human', male: true, value: 0 },
        MOST_JUMPS_SURVIVED: { name: '', race: 'human', male: true, value: 0 },
        MOST_SKILL_MASTERIES: { name: '', race: 'human', male: true, value: 0 },
      },
    },
  }
}

describe('score difficulty flags', () => {
  // prof.sav stored scores with the meanings of 0 and 1 backward. Getting this
  // wrong silently relabels every score in an old profile.
  const lookup = stubLookup({})

  it('reads flag 0 as NORMAL in fileFormat 4 and EASY in fileFormat 9', () => {
    for (const [fileFormat, expected] of [
      [4, 'NORMAL'],
      [9, 'EASY'],
    ] as const) {
      const p = emptyProfile(fileFormat)
      p.stats.topScores = [
        {
          shipName: 'Kestrel',
          shipId: 'PLAYER_SHIP_HARD',
          value: 1234,
          sector: 5,
          difficulty: expected,
          victory: false,
          dlcEnabled: false,
        },
      ]

      const { bytes } = writeProfile(p, lookup)
      const { profile } = readProfile(bytes, lookup)
      expect(profile.stats.topScores[0].difficulty).toBe(expected)
    }
  })

  it('round-trips every difficulty a fileFormat 9 score can hold', () => {
    const p = emptyProfile(9)
    p.stats.shipBest = (['EASY', 'NORMAL', 'HARD'] as const).map((difficulty, i) => ({
      shipName: `Ship ${i}`,
      shipId: 'PLAYER_SHIP_HARD',
      value: 100 * i,
      sector: i,
      difficulty,
      victory: i === 2,
      dlcEnabled: i !== 0,
    }))

    const { bytes } = writeProfile(p, lookup)
    const { profile } = readProfile(bytes, lookup)
    expect(profile.stats.shipBest).toEqual(p.stats.shipBest)
  })
})

describe('victory achievement variant flags', () => {
  const lookup = stubLookup({
    ACH_PLAIN: {},
    PLAYER_SHIP_HARD_VICTORY: { shipId: 'PLAYER_SHIP_HARD', victory: true },
  })

  it('stores three extra difficulties for victory records only', () => {
    const p = emptyProfile(9)
    p.achievements = [
      { achievementId: 'ACH_PLAIN', difficulty: 'NORMAL' },
      {
        achievementId: 'PLAYER_SHIP_HARD_VICTORY',
        difficulty: 'HARD',
        completedWithTypeA: 'EASY',
        completedWithTypeB: null,
        completedWithTypeC: 'HARD',
      },
    ]

    const { bytes } = writeProfile(p, lookup)
    const { profile } = readProfile(bytes, lookup)

    expect(profile.achievements[0]).toEqual({
      achievementId: 'ACH_PLAIN',
      difficulty: 'NORMAL',
    })
    expect(profile.achievements[1]).toEqual({
      achievementId: 'PLAYER_SHIP_HARD_VICTORY',
      difficulty: 'HARD',
      completedWithTypeA: 'EASY',
      completedWithTypeB: null,
      completedWithTypeC: 'HARD',
    })
  })

  it('writes -1 for a layout that has not earned the victory', () => {
    const p = emptyProfile(9)
    p.achievements = [
      { achievementId: 'PLAYER_SHIP_HARD_VICTORY', difficulty: 'EASY' },
    ]

    const { bytes } = writeProfile(p, lookup)
    const { profile } = readProfile(bytes, lookup)

    expect(profile.achievements[0].completedWithTypeA).toBeNull()
    expect(profile.achievements[0].completedWithTypeB).toBeNull()
    expect(profile.achievements[0].completedWithTypeC).toBeNull()
  })
})

describe('the write filter', () => {
  it('drops achievement ids this install does not define', () => {
    const p = emptyProfile(9)
    p.achievements = [
      { achievementId: 'ACH_KNOWN', difficulty: 'EASY' },
      { achievementId: 'ACH_FROM_SOME_MOD', difficulty: 'EASY' },
    ]

    const { bytes, droppedAchievementIds } = writeProfile(
      p,
      stubLookup({ ACH_KNOWN: {} }),
    )

    expect(droppedAchievementIds).toEqual(['ACH_FROM_SOME_MOD'])
    const { profile } = readProfile(bytes, stubLookup({ ACH_KNOWN: {} }))
    expect(profile.achievements.map((a) => a.achievementId)).toEqual(['ACH_KNOWN'])
  })

  it('drops victory and quest records from a fileFormat 4 profile', () => {
    // FTL 1.01-1.03.3 profiles have no quest or victory achievements.
    const lookup = stubLookup({
      ACH_PLAIN: {},
      SHIP_QUEST: { shipId: 'PLAYER_SHIP_ROCK', quest: true },
      SHIP_VICTORY: { shipId: 'PLAYER_SHIP_ROCK', victory: true },
    })

    const p = emptyProfile(4)
    p.achievements = [
      { achievementId: 'ACH_PLAIN', difficulty: 'EASY' },
      { achievementId: 'SHIP_QUEST', difficulty: 'EASY' },
      { achievementId: 'SHIP_VICTORY', difficulty: 'EASY' },
    ]

    const { droppedAchievementIds } = writeProfile(p, lookup)
    expect(droppedAchievementIds.sort()).toEqual(['SHIP_QUEST', 'SHIP_VICTORY'])
  })

  it('drops achievements for ships the format has no slot for', () => {
    // The Lanius Cruiser did not exist before Advanced Edition.
    const lookup = stubLookup({
      ACH_LANIUS: { shipId: 'PLAYER_SHIP_ANAEROBIC' },
    })

    const p = emptyProfile(4)
    p.achievements = [{ achievementId: 'ACH_LANIUS', difficulty: 'EASY' }]

    expect(writeProfile(p, lookup).droppedAchievementIds).toEqual(['ACH_LANIUS'])

    const aeProfile = emptyProfile(9)
    aeProfile.achievements = [{ achievementId: 'ACH_LANIUS', difficulty: 'EASY' }]
    expect(writeProfile(aeProfile, lookup).droppedAchievementIds).toEqual([])
  })
})

describe('ship unlock slots', () => {
  const lookup = stubLookup({})

  it('writes 12 slots with two bools each in fileFormat 9', () => {
    const p = emptyProfile(9)
    p.shipUnlocks = [
      { shipId: 'PLAYER_SHIP_HARD', unlockedA: true, unlockedC: true },
    ]

    const { bytes } = writeProfile(p, lookup)
    const { profile } = readProfile(bytes, lookup)

    expect(profile.shipUnlocks).toHaveLength(12)
    expect(profile.shipUnlocks[0]).toEqual({
      shipId: 'PLAYER_SHIP_HARD',
      unlockedA: true,
      unlockedC: true,
    })
    // Unnamed slots default to locked rather than going missing.
    expect(profile.shipUnlocks[1].unlockedA).toBe(false)
  })

  it('names the tenth slot differently per format', () => {
    for (const [fileFormat, tenthId] of [
      [4, 'UNKNOWN_ALPHA'],
      [9, 'PLAYER_SHIP_ANAEROBIC'],
    ] as const) {
      const { bytes } = writeProfile(emptyProfile(fileFormat), lookup)
      const { profile } = readProfile(bytes, lookup)
      expect(profile.shipUnlocks[9].shipId).toBe(tenthId)
    }
  })

  it('writes one bool per slot in fileFormat 4', () => {
    const { bytes } = writeProfile(emptyProfile(4), lookup)
    const { bytes: aeBytes } = writeProfile(emptyProfile(9), lookup)
    // 12 extra bools for the Type-C column, less the newbie tip int.
    expect(aeBytes.length - bytes.length).toBe(12 * 4 + 4)
  })
})

describe('malformed input', () => {
  const lookup = stubLookup({})

  it('rejects a file whose first int is not a known profile format', () => {
    // 11 is a saved game, which is the mistake a user will actually make.
    const bytes = new Uint8Array(new Int32Array([11, 0, 0, 0]).buffer)
    expect(() => readProfile(bytes, lookup)).toThrow(/Unexpected first byte \(11\)/)
  })

  it('rejects a string length that runs past the end of the file', () => {
    const bytes = new Uint8Array(
      new Int32Array([9, 2, 1, 0x7fffffff]).buffer,
    )
    expect(() => readProfile(bytes, lookup)).toThrow(/beyond the end of the file/)
  })
})

describe.skipIf(!hasGameDataFixture() || !hasProfileFixture())(
  `a real profile (${MISSING_PROFILE_MESSAGE}; ${MISSING_DATA_MESSAGE})`,
  () => {
    // Loaded lazily: skipIf still evaluates this callback, so reading fixtures
    // out here would break collection on a machine without them.
    let data: GameData
    let original: Uint8Array
    let profile: Profile
    let skippedAchievementIds: string[]

    beforeAll(() => {
      data = GameData.fromPack(loadDataPackFixture())
      original = loadProfileFixture()
      ;({ profile, skippedAchievementIds } = readProfile(original, data))
    })

    it('recognises every achievement the profile holds', () => {
      expect(skippedAchievementIds).toEqual([])
    })

    it('re-serialises byte for byte', () => {
      // The whole editor rests on this: anything the UI does not touch has to
      // come back out exactly as it went in.
      const { bytes } = writeProfile(profile, data)
      expect(bytes.length).toBe(original.length)
      expect([...bytes]).toEqual([...original])
    })

    it('reads an FTL 1.5.4+ profile', () => {
      expect(profile.fileFormat).toBe(9)
      expect(profile.newbieTipLevel).not.toBeNull()
    })

    it('reads the 12 ship unlock slots', () => {
      expect(profile.shipUnlocks).toHaveLength(12)
      expect(profile.shipUnlocks.map((s) => s.shipId)).toContain(
        'PLAYER_SHIP_ANAEROBIC',
      )
    })

    it('reads stats that agree with each other', () => {
      const { intRecords, topScores, crewRecords } = profile.stats

      expect(intRecords.TOTAL_GAMES_PLAYED).toBeGreaterThan(0)
      expect(intRecords.TOTAL_VICTORIES).toBeLessThanOrEqual(
        intRecords.TOTAL_GAMES_PLAYED,
      )
      expect(intRecords.MOST_SHIPS_DEFEATED).toBeLessThanOrEqual(
        intRecords.TOTAL_SHIPS_DEFEATED,
      )
      expect(intRecords.MOST_SCRAP_COLLECTED).toBeLessThanOrEqual(
        intRecords.TOTAL_SCRAP_COLLECTED,
      )

      expect(topScores.length).toBeGreaterThan(0)
      for (const score of topScores) {
        expect(score.value).toBeGreaterThan(0)
        expect(score.sector).toBeGreaterThan(0)
      }

      for (const rec of Object.values(crewRecords)) {
        expect(rec.name.length).toBeGreaterThan(0)
        expect(rec.race.length).toBeGreaterThan(0)
      }
    })

    it('resolves every ship id it mentions to a real blueprint', () => {
      for (const score of [...profile.stats.topScores, ...profile.stats.shipBest]) {
        expect(data.getShip(score.shipId), score.shipId).toBeDefined()
      }
    })

    it('survives a no-op edit of every achievement difficulty', () => {
      // Re-setting each record to the value it already holds must not shift
      // a single byte.
      const touched = {
        ...profile,
        achievements: profile.achievements.map((rec) => ({ ...rec })),
      }
      const { bytes } = writeProfile(touched, data)
      expect([...bytes]).toEqual([...original])
    })
  },
)
