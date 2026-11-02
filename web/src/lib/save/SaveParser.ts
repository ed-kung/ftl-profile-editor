import { BinaryReader, ParseError } from '../io/BinaryReader'
import { BinaryWriter } from '../io/BinaryWriter'
import { readBeacon, readEncounter, writeBeacon, writeEncounter } from './beacon'
import { readProjectile, writeProjectile } from './projectile'
import {
  readExtendedShipInfo,
  readShip,
  writeExtendedShipInfo,
  writeShip,
  type SaveLookup,
} from './ship'
import { blankStruct, readStruct, writeStruct } from './struct'
import {
  AE_TRANSIT_FIELDS,
  ASTEROID_FIELD_FIELDS,
  DIFFICULTY_FLAGS,
  ENVIRONMENT_HAZARD_FIELDS,
  ENVIRONMENT_TICK_FIELDS,
  HAZARD_VULNERABILITIES,
  NEARBY_SHIP_AI_FIELDS,
  PURSUIT_FIELDS,
  SESSION_FIELDS,
  isAE,
  type EnvironmentState,
  type RebelFlagshipState,
  type SavedGame,
} from './types'

export type { SaveLookup } from './ship'

/**
 * Reads and writes saved games.
 *
 * A port of net.blerf.ftl.parser.SavedGameParser, covering fileFormat 2
 * (FTL 1.01-1.03.3), 7, 8 and 9 (FTL 1.5.4-1.5.13) and 11 (FTL 1.6.1+).
 *
 * Format 2 can be read but not written, as in the Java editor.
 */

export const READABLE_FORMATS = [2, 7, 8, 9, 11]
export const WRITABLE_FORMATS = [7, 8, 9, 11]

export function canWriteFormat(fileFormat: number): boolean {
  return WRITABLE_FORMATS.includes(fileFormat)
}

function readCount<T>(reader: BinaryReader, readOne: () => T): T[] {
  const count = reader.readInt()
  const out: T[] = []
  for (let i = 0; i < count; i++) out.push(readOne())
  return out
}

function readEnvironment(reader: BinaryReader): EnvironmentState {
  const hazards = readStruct(reader, ENVIRONMENT_HAZARD_FIELDS)

  const at = reader.offset
  const vulnerableFlag = reader.readInt()
  const vulnerableShips = HAZARD_VULNERABILITIES[vulnerableFlag]
  if (!vulnerableShips) {
    throw new ParseError(`Unsupported environment vulnerability: ${vulnerableFlag}`, at)
  }

  const asteroidField = reader.readBool()
    ? readStruct(reader, ASTEROID_FIELD_FIELDS)
    : null

  return {
    ...hazards,
    vulnerableShips,
    asteroidField,
    ...readStruct(reader, ENVIRONMENT_TICK_FIELDS),
  }
}

function writeEnvironment(writer: BinaryWriter, env: EnvironmentState): void {
  writeStruct(writer, ENVIRONMENT_HAZARD_FIELDS, env)
  writer.writeInt(HAZARD_VULNERABILITIES.indexOf(env.vulnerableShips))

  writer.writeBool(env.asteroidField !== null)
  if (env.asteroidField) writeStruct(writer, ASTEROID_FIELD_FIELDS, env.asteroidField)

  writeStruct(writer, ENVIRONMENT_TICK_FIELDS, env)
}

export function readSavedGame(bytes: Uint8Array, lookup: SaveLookup): SavedGame {
  const reader = new BinaryReader(bytes)

  const fileFormat = reader.readInt()
  if (!READABLE_FORMATS.includes(fileFormat)) {
    throw new ParseError(
      `Unexpected first byte (${fileFormat}) for a SAVED GAME. Expected one of ` +
        `${READABLE_FORMATS.join(', ')}. Is this a profile rather than a saved game?`,
      0,
    )
  }
  const ae = isAE(fileFormat)

  // FTL 1.6.1 introduced UTF-8 strings.
  reader.setUnicode(fileFormat >= 11)

  // Always native before FTL 1.6.1.
  const randomNative = fileFormat === 11 ? reader.readBool() : true
  const dlcEnabled = ae ? reader.readBool() : false

  const difficultyAt = reader.offset
  const difficultyFlag = reader.readInt()
  const difficulty = DIFFICULTY_FLAGS[difficultyFlag]
  if (!difficulty || (difficulty === 'HARD' && !ae)) {
    throw new ParseError(`Unsupported difficulty flag: ${difficultyFlag}`, difficultyAt)
  }

  const session = readStruct(reader, SESSION_FIELDS)

  reader.readInt() // The 1-based sector number, stored properly further on.

  const unknownBeta = reader.readInt()

  const stateVars = readCount(reader, () => {
    const id = reader.readString()
    return { id, value: reader.readInt() }
  })

  const playerShip = readShip(reader, fileFormat, lookup)

  // Nearby ships have no cargo, so this isn't part of a ship.
  const cargoIds = readCount(reader, () => reader.readString())

  const pursuit = readStruct(reader, PURSUIT_FIELDS)

  const transit = blankStruct(AE_TRANSIT_FIELDS)
  if (ae) {
    Object.assign(transit, readStruct(reader, AE_TRANSIT_FIELDS))
  } else {
    transit.sectorHazardsVisible = reader.readBool()
    transit.rebelFlagshipVisible = reader.readBool()
    transit.rebelFlagshipHop = reader.readInt()
    transit.rebelFlagshipMoving = reader.readBool()
  }

  const sectorVisitation = readCount(reader, () => reader.readBool())
  const sectorNumber = reader.readInt()
  const sectorIsHiddenCrystalWorlds = reader.readBool()

  const beacons = readCount(reader, () => readBeacon(reader, fileFormat))

  const questEvents = readCount(reader, () => {
    const eventId = reader.readString()
    return { eventId, beaconId: reader.readInt() }
  })
  const distantQuestEventIds = readCount(reader, () => reader.readString())

  const game: SavedGame = {
    ...session,
    ...pursuit,
    ...transit,
    fileFormat,
    randomNative,
    dlcEnabled,
    difficulty,
    unknownBeta,
    stateVars,
    playerShip,
    cargoIds,
    sectorVisitation,
    sectorNumber,
    sectorIsHiddenCrystalWorlds,
    beacons,
    questEvents,
    distantQuestEventIds,
    unknownMu: 0,
    encounter: null,
    rebelFlagshipNearby: false,
    nearbyShip: null,
    nearbyShipAI: null,
    environment: null,
    projectiles: [],
    unknownNu: 0,
    unknownXi: null,
    autofire: false,
    rebelFlagship: {
      unknownAlpha: 0,
      pendingStage: 0,
      unknownGamma: 0,
      unknownDelta: 0,
      occupancy: [],
    },
  }

  if (ae) {
    readAETail(reader, game, lookup)
  } else {
    game.currentBeaconId = reader.readInt()

    if (reader.readBool()) game.nearbyShip = readShip(reader, fileFormat, lookup)

    game.rebelFlagship.pendingStage = reader.readInt()
    game.rebelFlagship.occupancy = readCount(reader, () => reader.readInt())
  }

  // The file should end here. Anything left is dropped on writing, which the
  // round-trip check reports, since it means the format has been misread.
  return game
}

/** Fills in what follows the beacons. `game` isn't visible to anything else yet. */
function readAETail(reader: BinaryReader, game: SavedGame, lookup: SaveLookup): void {
  const { fileFormat } = game

  game.unknownMu = reader.readInt()
  game.encounter = readEncounter(reader, fileFormat)

  if (reader.readBool()) {
    game.rebelFlagshipNearby = reader.readBool()
    game.nearbyShip = readShip(reader, fileFormat, lookup)
    game.nearbyShipAI = readStruct(reader, NEARBY_SHIP_AI_FIELDS)
  }

  game.environment = readEnvironment(reader)
  game.projectiles = readCount(reader, () => readProjectile(reader, fileFormat))

  readExtendedShipInfo(reader, game.playerShip, fileFormat, lookup)
  if (game.nearbyShip) {
    readExtendedShipInfo(reader, game.nearbyShip, fileFormat, lookup)
  }

  game.unknownNu = reader.readInt()
  if (game.nearbyShip) game.unknownXi = reader.readInt()

  game.autofire = reader.readBool()

  const flagship: RebelFlagshipState = {
    unknownAlpha: reader.readInt(),
    pendingStage: reader.readInt(),
    unknownGamma: reader.readInt(),
    unknownDelta: reader.readInt(),
    occupancy: readCount(reader, () => reader.readInt()),
  }
  game.rebelFlagship = flagship
}

export function writeSavedGame(game: SavedGame): Uint8Array {
  const { fileFormat } = game

  if (!canWriteFormat(fileFormat)) {
    throw new Error(`Saved games in format ${fileFormat} can be read but not written.`)
  }

  const writer = new BinaryWriter()

  writer.writeInt(fileFormat)
  writer.setUnicode(fileFormat >= 11)

  if (fileFormat === 11) writer.writeBool(game.randomNative)
  writer.writeBool(game.dlcEnabled)

  writer.writeInt(DIFFICULTY_FLAGS.indexOf(game.difficulty))
  writeStruct(writer, SESSION_FIELDS, game)

  writer.writeInt(game.sectorNumber + 1)
  writer.writeInt(game.unknownBeta)

  writer.writeInt(game.stateVars.length)
  for (const stateVar of game.stateVars) {
    writer.writeString(stateVar.id)
    writer.writeInt(stateVar.value)
  }

  writeShip(writer, game.playerShip, fileFormat)

  writer.writeInt(game.cargoIds.length)
  for (const cargoId of game.cargoIds) writer.writeString(cargoId)

  writeStruct(writer, PURSUIT_FIELDS, game)
  writeStruct(writer, AE_TRANSIT_FIELDS, game)

  writer.writeInt(game.sectorVisitation.length)
  for (const visited of game.sectorVisitation) writer.writeBool(visited)

  writer.writeInt(game.sectorNumber)
  writer.writeBool(game.sectorIsHiddenCrystalWorlds)

  writer.writeInt(game.beacons.length)
  for (const beacon of game.beacons) writeBeacon(writer, beacon, fileFormat)

  writer.writeInt(game.questEvents.length)
  for (const quest of game.questEvents) {
    writer.writeString(quest.eventId)
    writer.writeInt(quest.beaconId)
  }

  writer.writeInt(game.distantQuestEventIds.length)
  for (const eventId of game.distantQuestEventIds) writer.writeString(eventId)

  writer.writeInt(game.unknownMu)

  if (!game.encounter) throw new Error('This saved game has no encounter to write.')
  writeEncounter(writer, game.encounter, fileFormat)

  const { nearbyShip } = game
  writer.writeBool(nearbyShip !== null)
  if (nearbyShip) {
    if (!game.nearbyShipAI) throw new Error('The nearby ship has no AI to write.')

    writer.writeBool(game.rebelFlagshipNearby)
    writeShip(writer, nearbyShip, fileFormat)
    writeStruct(writer, NEARBY_SHIP_AI_FIELDS, game.nearbyShipAI)
  }

  if (!game.environment) throw new Error('This saved game has no environment to write.')
  writeEnvironment(writer, game.environment)

  writer.writeInt(game.projectiles.length)
  for (const projectile of game.projectiles) {
    writeProjectile(writer, projectile, fileFormat)
  }

  writeExtendedShipInfo(writer, game.playerShip, fileFormat)
  if (nearbyShip) writeExtendedShipInfo(writer, nearbyShip, fileFormat)

  writer.writeInt(game.unknownNu)
  if (nearbyShip) {
    if (game.unknownXi === null) throw new Error('The nearby ship has no Xi value to write.')
    writer.writeInt(game.unknownXi)
  }

  writer.writeBool(game.autofire)

  const flagship = game.rebelFlagship
  writer.writeInt(flagship.unknownAlpha)
  writer.writeInt(flagship.pendingStage)
  writer.writeInt(flagship.unknownGamma)
  writer.writeInt(flagship.unknownDelta)
  writer.writeInt(flagship.occupancy.length)
  for (const occupants of flagship.occupancy) writer.writeInt(occupants)

  return writer.toBytes()
}
