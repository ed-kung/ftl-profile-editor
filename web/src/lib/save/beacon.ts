import { ParseError, type BinaryReader } from '../io/BinaryReader'
import type { BinaryWriter } from '../io/BinaryWriter'
import { blankStruct, readStruct, writeStruct } from './struct'
import {
  BEACON_BACKGROUND_FIELDS,
  BEACON_ENEMY_FIELDS,
  ENCOUNTER_EVENT_FIELDS,
  FLEET_PRESENCES,
  STORE_ITEM_TYPES,
  STORE_SUPPLY_FIELDS,
  isAE,
  type BeaconState,
  type EncounterState,
  type StoreItem,
  type StoreShelf,
  type StoreState,
} from './types'

const SHELF_SLOTS = 3

/** Store items carry extra data from FTL 1.5.12. */
const hasItemExtraData = (fileFormat: number) => fileFormat >= 8

function readStoreShelf(reader: BinaryReader, fileFormat: number): StoreShelf {
  const at = reader.offset
  const itemType = STORE_ITEM_TYPES[reader.readInt()]
  if (!itemType) throw new ParseError('Unknown store item type', at)

  const slots: Array<StoreItem | null> = []
  for (let i = 0; i < SHELF_SLOTS; i++) {
    const available = reader.readInt() // -1=no item, 0=bought already, 1=buyable
    if (available < 0) {
      slots.push(null)
      continue
    }

    const itemId = reader.readString()
    const extraData = hasItemExtraData(fileFormat) ? reader.readInt() : 0
    slots.push({ itemId, available: available > 0, extraData })
  }

  return { itemType, slots }
}

function writeStoreShelf(
  writer: BinaryWriter,
  shelf: StoreShelf,
  fileFormat: number,
): void {
  writer.writeInt(STORE_ITEM_TYPES.indexOf(shelf.itemType))

  for (let i = 0; i < SHELF_SLOTS; i++) {
    const item = shelf.slots[i]
    if (!item) {
      writer.writeInt(-1)
      continue
    }

    writer.writeInt(item.available ? 1 : 0)
    writer.writeString(item.itemId)
    if (hasItemExtraData(fileFormat)) writer.writeInt(item.extraData)
  }
}

function readStore(reader: BinaryReader, fileFormat: number): StoreState {
  // FTL 1.01-1.03.3 always had two shelves. FTL 1.5.4 made it a list.
  const shelfCount = isAE(fileFormat) ? reader.readInt() : 2

  const shelves: StoreShelf[] = []
  for (let i = 0; i < shelfCount; i++) {
    shelves.push(readStoreShelf(reader, fileFormat))
  }

  return { ...readStruct(reader, STORE_SUPPLY_FIELDS), shelves }
}

function writeStore(writer: BinaryWriter, store: StoreState, fileFormat: number): void {
  // FTL 1.5.4+ requires at least one shelf.
  const shelves =
    store.shelves.length > 0
      ? store.shelves
      : [{ itemType: 'WEAPON' as const, slots: [null, null, null] }]

  writer.writeInt(shelves.length)
  for (const shelf of shelves) writeStoreShelf(writer, shelf, fileFormat)

  writeStruct(writer, STORE_SUPPLY_FIELDS, store)
}

export function readBeacon(reader: BinaryReader, fileFormat: number): BeaconState {
  const visitCount = reader.readInt()
  const background =
    visitCount > 0
      ? readStruct(reader, BEACON_BACKGROUND_FIELDS)
      : blankStruct(BEACON_BACKGROUND_FIELDS)

  const seen = reader.readBool()

  const enemyPresent = reader.readBool()
  const enemy = enemyPresent
    ? readStruct(reader, BEACON_ENEMY_FIELDS)
    : blankStruct(BEACON_ENEMY_FIELDS)

  const at = reader.offset
  const fleetPresenceFlag = reader.readInt()
  const fleetPresence = FLEET_PRESENCES[fleetPresenceFlag]
  if (!fleetPresence) {
    throw new ParseError(`Unknown fleet presence: ${fleetPresenceFlag}`, at)
  }

  const underAttack = reader.readBool()
  const store = reader.readBool() ? readStore(reader, fileFormat) : null

  return {
    ...background,
    ...enemy,
    visitCount,
    seen,
    enemyPresent,
    fleetPresence,
    underAttack,
    store,
  }
}

export function writeBeacon(
  writer: BinaryWriter,
  beacon: BeaconState,
  fileFormat: number,
): void {
  writer.writeInt(beacon.visitCount)
  if (beacon.visitCount > 0) writeStruct(writer, BEACON_BACKGROUND_FIELDS, beacon)

  writer.writeBool(beacon.seen)

  writer.writeBool(beacon.enemyPresent)
  if (beacon.enemyPresent) writeStruct(writer, BEACON_ENEMY_FIELDS, beacon)

  writer.writeInt(FLEET_PRESENCES.indexOf(beacon.fleetPresence))
  writer.writeBool(beacon.underAttack)

  writer.writeBool(beacon.store !== null)
  if (beacon.store) writeStore(writer, beacon.store, fileFormat)
}

export function readEncounter(reader: BinaryReader, fileFormat: number): EncounterState {
  const events = readStruct(reader, ENCOUNTER_EVENT_FIELDS)
  const unknownAlpha = fileFormat === 11 ? reader.readInt() : 0
  const text = reader.readString()
  const affectedCrewSeed = reader.readInt()

  const choiceCount = reader.readInt()
  const choices: number[] = []
  for (let i = 0; i < choiceCount; i++) choices.push(reader.readInt())

  return { ...events, unknownAlpha, text, affectedCrewSeed, choices }
}

export function writeEncounter(
  writer: BinaryWriter,
  encounter: EncounterState,
  fileFormat: number,
): void {
  writeStruct(writer, ENCOUNTER_EVENT_FIELDS, encounter)
  if (fileFormat === 11) writer.writeInt(encounter.unknownAlpha)
  writer.writeString(encounter.text)
  writer.writeInt(encounter.affectedCrewSeed)

  writer.writeInt(encounter.choices.length)
  for (const choice of encounter.choices) writer.writeInt(choice)
}
