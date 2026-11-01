import { BinaryReader, ParseError } from '../io/BinaryReader'
import { BinaryWriter } from '../io/BinaryWriter'
import {
  CREW_STAT_TYPES,
  INT_STAT_TYPES,
  type AchievementRecord,
  type CrewRecord,
  type CrewStatType,
  type Difficulty,
  type IntStatType,
  type NewbieTipLevel,
  type Profile,
  type Score,
  type ShipAvailability,
  type Stats,
} from './types'

/**
 * Reads and writes FTL profiles.
 *
 * A port of net.blerf.ftl.parser.ProfileParser, covering fileFormat 4
 * (FTL 1.01-1.03.3, "prof.sav") and 9 (FTL 1.5.4+, "ae_prof.sav").
 *
 * Parsing depends on game data: an achievement's record carries three extra
 * ints when it is a ship Victory achievement, and achievements the install
 * doesn't know about are skipped. So every entry point takes a lookup.
 */

/** Just enough of GameData for the parser's needs. */
export interface AchievementLookup {
  getAchievement(id: string): { shipId: string | null; victory: boolean; quest: boolean } | undefined
}

/** Ids whose records the profile keeps slots for but FTL never fills. */
const FILLER_SHIP_IDS_V4 = ['UNKNOWN_ALPHA', 'UNKNOWN_BETA', 'UNKNOWN_GAMMA']
const FILLER_SHIP_IDS_V9 = ['PLAYER_SHIP_ANAEROBIC', 'UNKNOWN_BETA', 'UNKNOWN_GAMMA']

const UNLOCKABLE_SHIP_IDS = [
  'PLAYER_SHIP_HARD',
  'PLAYER_SHIP_STEALTH',
  'PLAYER_SHIP_MANTIS',
  'PLAYER_SHIP_CIRCLE',
  'PLAYER_SHIP_FED',
  'PLAYER_SHIP_JELLY',
  'PLAYER_SHIP_ROCK',
  'PLAYER_SHIP_ENERGY',
  'PLAYER_SHIP_CRYSTAL',
]

/**
 * The 12 ship slots a profile stores, in order.
 *
 * Yes, the format has 12 slots for 9 ships (10 with the DLC).
 */
function unlockableShipIds(fileFormat: number): string[] {
  return [
    ...UNLOCKABLE_SHIP_IDS,
    ...(fileFormat === 4 ? FILLER_SHIP_IDS_V4 : FILLER_SHIP_IDS_V9),
  ]
}

/** The ships whose achievements a profile of this format can hold. */
function writableShipBaseIds(fileFormat: number): string[] {
  return fileFormat === 9
    ? [...UNLOCKABLE_SHIP_IDS, 'PLAYER_SHIP_ANAEROBIC']
    : [...UNLOCKABLE_SHIP_IDS]
}

export interface ReadProfileResult {
  profile: Profile
  /**
   * Achievement ids in the file that this install's data doesn't define.
   *
   * They are dropped, so saving removes them. Worth telling the user about:
   * it usually means a mod was uninstalled, or the wrong game directory was
   * selected.
   */
  skippedAchievementIds: string[]
}

export function readProfile(
  bytes: Uint8Array,
  data: AchievementLookup,
): ReadProfileResult {
  const reader = new BinaryReader(bytes)
  const skippedAchievementIds: string[] = []

  const fileFormat = reader.readInt()

  // FTL 1.6.1 introduced UTF-8 strings. There's no magic number for that
  // version, so all AE profiles are assumed unicode rather than windows-1252.
  // Exotic characters in an FTL 1.5.4+ profile are therefore a problem; only
  // ASCII is safe, short of making the FTL version selectable on open.
  reader.setUnicode(fileFormat >= 9)

  let newbieTipLevel: NewbieTipLevel | null = null

  if (fileFormat === 4) {
    // FTL 1.03.3 and earlier.
  } else if (fileFormat === 9) {
    // FTL 1.5.4+.
    const at = reader.offset
    const newbieFlag = reader.readInt()
    if (newbieFlag === 0) newbieTipLevel = 'SHIPS_UNLOCKED'
    else if (newbieFlag === 1) newbieTipLevel = 'SHIP_LIST_INTRO'
    else if (newbieFlag === 2) newbieTipLevel = 'VETERAN'
    else {
      throw new ParseError(`Unsupported newbie tip level flag: ${newbieFlag}`, at)
    }
  } else {
    throw new ParseError(
      `Unexpected first byte (${fileFormat}) for a PROFILE. Expected 4 (FTL 1.01-1.03.3) ` +
        `or 9 (FTL 1.5.4+). Is this a saved game rather than a profile?`,
      0,
    )
  }

  const achievements = readAchievements(
    reader,
    fileFormat,
    data,
    skippedAchievementIds,
  )
  const shipUnlocks = readShipUnlocks(reader, fileFormat)
  const stats = readStats(reader, fileFormat)

  return {
    profile: { fileFormat, newbieTipLevel, achievements, shipUnlocks, stats },
    skippedAchievementIds,
  }
}

export interface WriteProfileResult {
  bytes: Uint8Array
  /** Achievement ids the format or this install's data won't allow. */
  droppedAchievementIds: string[]
}

export function writeProfile(
  p: Profile,
  data: AchievementLookup,
): WriteProfileResult {
  const writer = new BinaryWriter()
  writer.writeInt(p.fileFormat)
  writer.setUnicode(p.fileFormat >= 9)

  if (p.fileFormat === 9) {
    let newbieFlag = 0
    if (p.newbieTipLevel === 'SHIPS_UNLOCKED') newbieFlag = 0
    else if (p.newbieTipLevel === 'SHIP_LIST_INTRO') newbieFlag = 1
    else if (p.newbieTipLevel === 'VETERAN') newbieFlag = 2
    writer.writeInt(newbieFlag)
  }

  const droppedAchievementIds = writeAchievements(writer, p, data)
  writeShipUnlocks(writer, p)
  writeStats(writer, p.stats, p.fileFormat)

  return { bytes: writer.toBytes(), droppedAchievementIds }
}

function readDifficulty(reader: BinaryReader, fileFormat: number, what: string): Difficulty {
  const at = reader.offset
  const flag = reader.readInt()

  if (flag === 0) return 'EASY'
  if (flag === 1) return 'NORMAL'
  if (flag === 2 && fileFormat === 9) return 'HARD'

  throw new ParseError(`Unsupported difficulty flag for ${what}: ${flag}`, at)
}

function difficultyFlag(d: Difficulty, fileFormat: number): number {
  if (d === 'EASY') return 0
  if (d === 'NORMAL') return 1
  if (d === 'HARD' && fileFormat === 9) return 2

  // HARD in a fileFormat 4 profile: the old game had no such difficulty.
  return 0
}

function readAchievements(
  reader: BinaryReader,
  fileFormat: number,
  data: AchievementLookup,
  skipped: string[],
): AchievementRecord[] {
  const count = reader.readInt()
  const achievements: AchievementRecord[] = []

  for (let i = 0; i < count; i++) {
    const achievementId = reader.readString()
    const difficulty = readDifficulty(
      reader,
      fileFormat,
      `achievement ${i} ("${achievementId}")`,
    )

    const ach = data.getAchievement(achievementId)
    if (!ach) {
      skipped.push(achievementId)
      continue
    }

    const rec: AchievementRecord = { achievementId, difficulty }

    if (fileFormat === 9 && ach.victory) {
      // Ship Victory achievements record which Type-ABC layouts earned them.
      // Each flag is that run's difficulty, or -1 for "not with this layout".
      const variants: Array<Difficulty | null> = []
      for (let j = 0; j < 3; j++) {
        const at = reader.offset
        const flag = reader.readInt()

        if (flag === -1) variants.push(null)
        else if (flag === 0) variants.push('EASY')
        else if (flag === 1) variants.push('NORMAL')
        else if (flag === 2) variants.push('HARD')
        else {
          throw new ParseError(
            `Unsupported per-layout difficulty flag for achievement ${i} ` +
              `("${achievementId}"): ${flag}`,
            at,
          )
        }
      }
      rec.completedWithTypeA = variants[0]
      rec.completedWithTypeB = variants[1]
      rec.completedWithTypeC = variants[2]
    }

    achievements.push(rec)
  }

  return achievements
}

function writeAchievements(
  writer: BinaryWriter,
  p: Profile,
  data: AchievementLookup,
): string[] {
  const { fileFormat } = p
  const shipBaseIds = writableShipBaseIds(fileFormat)

  const writable: AchievementRecord[] = []
  const dropped: string[] = []

  for (const rec of p.achievements) {
    const ach = data.getAchievement(rec.achievementId)
    if (!ach) {
      dropped.push(rec.achievementId)
      continue
    }

    // FTL 1.01-1.03.3 profiles have no quest or victory achievements.
    if (fileFormat === 4 && (ach.victory || ach.quest)) {
      dropped.push(rec.achievementId)
      continue
    }

    // Drop achievements for ships this format has no slot for, such as the
    // Lanius Cruiser in an old profile.
    if (ach.shipId !== null && !shipBaseIds.includes(ach.shipId)) {
      dropped.push(rec.achievementId)
      continue
    }

    writable.push(rec)
  }

  writer.writeInt(writable.length)

  for (const rec of writable) {
    writer.writeString(rec.achievementId)
    writer.writeInt(difficultyFlag(rec.difficulty, fileFormat))

    if (fileFormat === 9 && data.getAchievement(rec.achievementId)!.victory) {
      const variants = [
        rec.completedWithTypeA ?? null,
        rec.completedWithTypeB ?? null,
        rec.completedWithTypeC ?? null,
      ]
      for (const variant of variants) {
        writer.writeInt(variant === null ? -1 : difficultyFlag(variant, fileFormat))
      }
    }
  }

  return dropped
}

function readShipUnlocks(
  reader: BinaryReader,
  fileFormat: number,
): ShipAvailability[] {
  return unlockableShipIds(fileFormat).map((shipId) => ({
    shipId,
    unlockedA: reader.readBool(),
    unlockedC: fileFormat === 9 ? reader.readBool() : false,
  }))
}

function writeShipUnlocks(writer: BinaryWriter, p: Profile): void {
  const byId = new Map(p.shipUnlocks.map((avail) => [avail.shipId, avail]))

  for (const shipId of unlockableShipIds(p.fileFormat)) {
    const avail = byId.get(shipId)
    writer.writeBool(avail?.unlockedA ?? false)
    if (p.fileFormat === 9) {
      writer.writeBool(avail?.unlockedC ?? false)
    }
  }
}

function readStats(reader: BinaryReader, fileFormat: number): Stats {
  const topScores = readScoreList(reader, fileFormat)
  const shipBest = readScoreList(reader, fileFormat)

  const intRecords = {} as Record<IntStatType, number>
  for (const type of INT_STAT_TYPES) {
    intRecords[type] = reader.readInt()
  }

  const crewRecords = {} as Record<CrewStatType, CrewRecord>
  for (const type of CREW_STAT_TYPES) {
    crewRecords[type] = readCrewRecord(reader)
  }

  return { topScores, shipBest, intRecords, crewRecords }
}

function writeStats(writer: BinaryWriter, stats: Stats, fileFormat: number): void {
  writeScoreList(writer, stats.topScores, fileFormat)
  writeScoreList(writer, stats.shipBest, fileFormat)

  for (const type of INT_STAT_TYPES) {
    writer.writeInt(stats.intRecords[type] ?? 0)
  }
  for (const type of CREW_STAT_TYPES) {
    writeCrewRecord(writer, stats.crewRecords[type])
  }
}

function readCrewRecord(reader: BinaryReader): CrewRecord {
  const value = reader.readInt()
  const name = reader.readString()
  const race = reader.readString()
  const male = reader.readBool()

  return { name, race, male, value }
}

function writeCrewRecord(writer: BinaryWriter, rec: CrewRecord): void {
  writer.writeInt(rec.value)
  writer.writeString(rec.name)
  writer.writeString(rec.race)
  writer.writeBool(rec.male)
}

function readScoreList(reader: BinaryReader, fileFormat: number): Score[] {
  const count = reader.readInt()
  const scores: Score[] = []

  for (let i = 0; i < count; i++) {
    const shipName = reader.readString()
    const shipId = reader.readString()
    const value = reader.readInt()
    const sector = reader.readInt()
    const victory = reader.readInt() === 1

    const at = reader.offset
    const flag = reader.readInt()

    // In "prof.sav", scores' difficulty had the meanings of 0 and 1 backward.
    let difficulty: Difficulty
    if (fileFormat === 4) {
      if (flag === 0) difficulty = 'NORMAL'
      else if (flag === 1) difficulty = 'EASY'
      else {
        throw new ParseError(
          `Unsupported difficulty flag for score ${i} ("${shipName}"): ${flag}`,
          at,
        )
      }
    } else {
      if (flag === 0) difficulty = 'EASY'
      else if (flag === 1) difficulty = 'NORMAL'
      else if (flag === 2) difficulty = 'HARD'
      else {
        throw new ParseError(
          `Unsupported difficulty flag for score ${i} ("${shipName}"): ${flag}`,
          at,
        )
      }
    }

    scores.push({
      shipName,
      shipId,
      value,
      sector,
      difficulty,
      victory,
      dlcEnabled: fileFormat === 9 ? reader.readBool() : false,
    })
  }

  return scores
}

function writeScoreList(
  writer: BinaryWriter,
  scores: Score[],
  fileFormat: number,
): void {
  writer.writeInt(scores.length)

  for (const score of scores) {
    writer.writeString(score.shipName)
    writer.writeString(score.shipId)
    writer.writeInt(score.value)
    writer.writeInt(score.sector)
    writer.writeInt(score.victory ? 1 : 0)
    writer.writeInt(scoreDifficultyFlag(score.difficulty, fileFormat))

    if (fileFormat === 9) {
      writer.writeBool(score.dlcEnabled)
    }
  }
}

/** Scores swap the meanings of flags 0 and 1 between the two formats. */
function scoreDifficultyFlag(d: Difficulty, fileFormat: number): number {
  if (fileFormat === 4) {
    if (d === 'NORMAL') return 0
    if (d === 'EASY') return 1
    // HARD didn't exist; EASY is the safe substitute.
    return 1
  }

  if (d === 'EASY') return 0
  if (d === 'NORMAL') return 1
  return 2
}
