/**
 * The contents of an FTL profile ("ae_prof.sav" / "prof.sav").
 *
 * Mirrors net.blerf.ftl.model.Profile and friends. Plain data throughout: the
 * Java getters and setters become fields, and copying is done with structured
 * helpers rather than copy constructors.
 */

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD'

export const DIFFICULTIES: Difficulty[] = ['EASY', 'NORMAL', 'HARD']

/** Pending tips to display for new players, in the hangar menu. */
export type NewbieTipLevel = 'SHIPS_UNLOCKED' | 'SHIP_LIST_INTRO' | 'VETERAN'

export const NEWBIE_TIP_LEVELS: NewbieTipLevel[] = [
  'SHIPS_UNLOCKED',
  'SHIP_LIST_INTRO',
  'VETERAN',
]

export const NEWBIE_TIP_LEVEL_LABELS: Record<NewbieTipLevel, string> = {
  SHIPS_UNLOCKED: 'Ships Unlocked',
  SHIP_LIST_INTRO: 'Ship List Intro',
  VETERAN: 'Veteran',
}

export interface AchievementRecord {
  achievementId: string
  difficulty: Difficulty
  /**
   * For ship Victory achievements: the difficulty each layout earned it on,
   * or null for "not with that layout". Absent entirely on other achievements.
   */
  completedWithTypeA?: Difficulty | null
  completedWithTypeB?: Difficulty | null
  completedWithTypeC?: Difficulty | null
}

export interface ShipAvailability {
  shipId: string
  unlockedA: boolean
  unlockedC: boolean
}

export interface Score {
  shipName: string
  shipId: string
  value: number
  sector: number
  difficulty: Difficulty
  victory: boolean
  dlcEnabled: boolean
}

export interface CrewRecord {
  name: string
  race: string
  male: boolean
  value: number
}

/** Stat types holding a plain number, in the order the profile stores them. */
export const INT_STAT_TYPES = [
  'MOST_SHIPS_DEFEATED',
  'TOTAL_SHIPS_DEFEATED',
  'MOST_BEACONS_EXPLORED',
  'TOTAL_BEACONS_EXPLORED',
  'MOST_SCRAP_COLLECTED',
  'TOTAL_SCRAP_COLLECTED',
  'MOST_CREW_HIRED',
  'TOTAL_CREW_HIRED',
  'TOTAL_GAMES_PLAYED',
  'TOTAL_VICTORIES',
] as const

export type IntStatType = (typeof INT_STAT_TYPES)[number]

/** Stat types holding a crew member's record, in storage order. */
export const CREW_STAT_TYPES = [
  'MOST_REPAIRS',
  'MOST_COMBAT_KILLS',
  'MOST_PILOTED_EVASIONS',
  'MOST_JUMPS_SURVIVED',
  'MOST_SKILL_MASTERIES',
] as const

export type CrewStatType = (typeof CREW_STAT_TYPES)[number]

export const STAT_LABELS: Record<IntStatType | CrewStatType, string> = {
  MOST_SHIPS_DEFEATED: 'Most Ships Defeated',
  MOST_BEACONS_EXPLORED: 'Most Beacons Explored',
  MOST_SCRAP_COLLECTED: 'Most Scrap Collected',
  MOST_CREW_HIRED: 'Most Crew Hired',
  MOST_REPAIRS: 'Most Repairs',
  MOST_COMBAT_KILLS: 'Most Combat Kills',
  MOST_PILOTED_EVASIONS: 'Most Piloted Evasions',
  MOST_JUMPS_SURVIVED: 'Most Jumps Survived',
  MOST_SKILL_MASTERIES: 'Most Skill Masteries',
  TOTAL_SHIPS_DEFEATED: 'Total Ships Defeated',
  TOTAL_BEACONS_EXPLORED: 'Total Beacons Explored',
  TOTAL_SCRAP_COLLECTED: 'Total Scrap Collected',
  TOTAL_CREW_HIRED: 'Total Crew Hired',
  TOTAL_GAMES_PLAYED: 'Total Games Played',
  TOTAL_VICTORIES: 'Total Victories',
}

/** The int stats describing a single best run. */
export const SESSION_RECORD_TYPES: IntStatType[] = [
  'MOST_SHIPS_DEFEATED',
  'MOST_BEACONS_EXPLORED',
  'MOST_SCRAP_COLLECTED',
  'MOST_CREW_HIRED',
]

/** The int stats accumulated across every run. */
export const TOTAL_STAT_TYPES: IntStatType[] = [
  'TOTAL_SHIPS_DEFEATED',
  'TOTAL_BEACONS_EXPLORED',
  'TOTAL_SCRAP_COLLECTED',
  'TOTAL_CREW_HIRED',
  'TOTAL_GAMES_PLAYED',
  'TOTAL_VICTORIES',
]

export interface Stats {
  topScores: Score[]
  shipBest: Score[]
  intRecords: Record<IntStatType, number>
  crewRecords: Record<CrewStatType, CrewRecord>
}

export interface Profile {
  /** 4 for FTL 1.01-1.03.3, 9 for FTL 1.5.4+. */
  fileFormat: number
  /** Only present in fileFormat 9. */
  newbieTipLevel: NewbieTipLevel | null
  achievements: AchievementRecord[]
  /** Keyed by ship id, in the fixed order the profile stores its slots. */
  shipUnlocks: ShipAvailability[]
  stats: Stats
}

export function findAchievement(
  records: AchievementRecord[],
  achievementId: string,
): AchievementRecord | undefined {
  return records.find((rec) => rec.achievementId === achievementId)
}

export function withoutAchievement(
  records: AchievementRecord[],
  achievementId: string,
): AchievementRecord[] {
  return records.filter((rec) => rec.achievementId !== achievementId)
}

export function findShipUnlock(
  unlocks: ShipAvailability[],
  shipId: string,
): ShipAvailability | undefined {
  return unlocks.find((avail) => avail.shipId === shipId)
}

export function emptyCrewRecord(): CrewRecord {
  return { name: '', race: 'human', male: true, value: 0 }
}

export function cloneProfile(p: Profile): Profile {
  return {
    fileFormat: p.fileFormat,
    newbieTipLevel: p.newbieTipLevel,
    achievements: p.achievements.map((rec) => ({ ...rec })),
    shipUnlocks: p.shipUnlocks.map((avail) => ({ ...avail })),
    stats: {
      topScores: p.stats.topScores.map((s) => ({ ...s })),
      shipBest: p.stats.shipBest.map((s) => ({ ...s })),
      intRecords: { ...p.stats.intRecords },
      crewRecords: Object.fromEntries(
        Object.entries(p.stats.crewRecords).map(([k, v]) => [k, { ...v }]),
      ) as Record<CrewStatType, CrewRecord>,
    },
  }
}
