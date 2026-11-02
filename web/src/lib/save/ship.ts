import { ParseError, type BinaryReader } from '../io/BinaryReader'
import type { BinaryWriter } from '../io/BinaryWriter'
import { readDronePod, writeDronePod } from './dronePod'
import { readAnim, readProjectile, writeAnim, writeProjectile } from './projectile'
import { blankStruct, readStruct, writeStruct } from './struct'
import {
  ANIM_FIELDS,
  BATTERY_FIELDS,
  CLOAKING_FIELDS,
  CLONEBAY_FIELDS,
  CREW_AE_FIELDS,
  CREW_CRYSTAL_FIELDS,
  CREW_IDENTITY_FIELDS,
  CREW_MASTERY_FIELDS,
  CREW_SAVED_ROOM_FIELDS,
  CREW_SKILL_FIELDS,
  DOOR_AE_FIELDS,
  DOOR_FIELDS,
  DOOR_HEALTH_FIELDS,
  DRONE_EXTENDED_FIELDS,
  DRONE_FIELDS,
  HACKING_FIELDS,
  LOCKDOWN_CRYSTAL_FIELDS,
  MIND_FIELDS,
  ORIGINAL_SYSTEM_COUNT,
  PODLESS_DRONE_TYPES,
  SHIELDS_FIELDS,
  SHIP_ID_FIELDS,
  SHIP_JUMP_FIELDS,
  SHIP_SUPPLY_FIELDS,
  SQUARE_FIELDS,
  STANDALONE_DRONE_TAIL_FIELDS,
  STARTING_CREW_FIELDS,
  STATION_DIRECTIONS,
  SYSTEM_AE_FIELDS,
  SYSTEM_FIELDS,
  SYSTEM_TYPES,
  WEAPON_COOLDOWN_FIELDS,
  WEAPON_FIRING_FIELDS,
  WEAPON_TARGETING_FIELDS,
  asDroneType,
  isAE,
  type CrewState,
  type DoorState,
  type DroneType,
  type RoomState,
  type ShipState,
  type SquareState,
  type SystemState,
  type SystemType,
  type WeaponModuleState,
  type WeaponState,
  type XYPair,
} from './types'
import type { ShipLayout, ShipLayoutRoom } from '../data/shipLayout'

/**
 * The game data needed to find a saved game's structure.
 *
 * Only reading needs it: everything a write depends on is kept in the state.
 */
export interface SaveLookup {
  getShip(id: string):
    | { layoutId: string | null; systemRooms: Record<string, number[]> }
    | undefined
  getShipLayout(id: string): ShipLayout | undefined
  getDrone(id: string): { type: string | null } | undefined
}

/** Lockdown crystals and crew masteries arrived in FTL 1.5.12. */
const hasFormat8Fields = (fileFormat: number) => fileFormat >= 8
/** Weapon charge animations arrived in FTL 1.5.13. */
const hasChargeAnim = (fileFormat: number) => fileFormat >= 9

function readCount<T>(reader: BinaryReader, readOne: () => T): T[] {
  const count = reader.readInt()
  const out: T[] = []
  for (let i = 0; i < count; i++) out.push(readOne())
  return out
}

/** The first record of a system, or undefined if it has no capacity. */
export function installedSystem(
  ship: ShipState,
  type: SystemType,
): SystemState | undefined {
  const system = ship.systems.find((s) => s.type === type)
  return system && system.capacity > 0 ? system : undefined
}

function systemTypesFor(fileFormat: number): readonly SystemType[] {
  return isAE(fileFormat) ? SYSTEM_TYPES : SYSTEM_TYPES.slice(0, ORIGINAL_SYSTEM_COUNT)
}

function readCrewMember(reader: BinaryReader, fileFormat: number): CrewState {
  const ae = isAE(fileFormat)

  const identity = readStruct(reader, CREW_IDENTITY_FIELDS)

  let cloneReady = 0
  let spriteTintIndeces: number[] = []
  let savedRoom = blankStruct(CREW_SAVED_ROOM_FIELDS)
  if (ae) {
    cloneReady = reader.readInt()
    reader.readInt() // Death order. Always equal to clonebayPriority.
    spriteTintIndeces = readCount(reader, () => reader.readInt())
    savedRoom = readStruct(reader, CREW_SAVED_ROOM_FIELDS)
  }

  const skills = readStruct(reader, CREW_SKILL_FIELDS)

  const crew: CrewState = {
    ...identity,
    ...savedRoom,
    ...skills,
    ...blankStruct(CREW_AE_FIELDS),
    ...blankStruct(CREW_MASTERY_FIELDS),
    ...blankStruct(CREW_CRYSTAL_FIELDS),
    cloneReady,
    spriteTintIndeces,
    unknownNu: false,
    teleportAnim: blankStruct(ANIM_FIELDS),
    unknownPhi: false,
  }
  if (!ae) return crew

  Object.assign(crew, readStruct(reader, CREW_AE_FIELDS))
  if (hasFormat8Fields(fileFormat)) {
    Object.assign(crew, readStruct(reader, CREW_MASTERY_FIELDS))
  }
  crew.unknownNu = reader.readBool()
  crew.teleportAnim = readAnim(reader)
  crew.unknownPhi = reader.readBool()
  if (crew.race === 'crystal') {
    Object.assign(crew, readStruct(reader, CREW_CRYSTAL_FIELDS))
  }

  return crew
}

function writeCrewMember(
  writer: BinaryWriter,
  crew: CrewState,
  fileFormat: number,
): void {
  const ae = isAE(fileFormat)

  writeStruct(writer, CREW_IDENTITY_FIELDS, crew)

  if (ae) {
    writer.writeInt(crew.cloneReady)
    writer.writeInt(crew.clonebayPriority) // Death order.
    writer.writeInt(crew.spriteTintIndeces.length)
    for (const tint of crew.spriteTintIndeces) writer.writeInt(tint)
    writeStruct(writer, CREW_SAVED_ROOM_FIELDS, crew)
  }

  writeStruct(writer, CREW_SKILL_FIELDS, crew)

  if (!ae) return

  writeStruct(writer, CREW_AE_FIELDS, crew)
  if (hasFormat8Fields(fileFormat)) writeStruct(writer, CREW_MASTERY_FIELDS, crew)
  writer.writeBool(crew.unknownNu)
  writeAnim(writer, crew.teleportAnim)
  writer.writeBool(crew.unknownPhi)
  if (crew.race === 'crystal') writeStruct(writer, CREW_CRYSTAL_FIELDS, crew)
}

/** An uninstalled system: on disk, nothing but its zero capacity. */
export function blankSystem(type: SystemType): SystemState {
  return {
    ...blankStruct(SYSTEM_FIELDS),
    ...blankStruct(SYSTEM_AE_FIELDS),
    type,
    capacity: 0,
  }
}

function readSystem(
  reader: BinaryReader,
  type: SystemType,
  fileFormat: number,
): SystemState {
  const system = blankSystem(type)

  system.capacity = reader.readInt()
  if (system.capacity <= 0) return system

  Object.assign(system, readStruct(reader, SYSTEM_FIELDS))
  if (isAE(fileFormat)) Object.assign(system, readStruct(reader, SYSTEM_AE_FIELDS))

  return system
}

function writeSystem(
  writer: BinaryWriter,
  system: SystemState,
  fileFormat: number,
): void {
  writer.writeInt(system.capacity)
  if (system.capacity <= 0) return

  writeStruct(writer, SYSTEM_FIELDS, system)
  if (isAE(fileFormat)) writeStruct(writer, SYSTEM_AE_FIELDS, system)
}

function readRoom(
  reader: BinaryReader,
  { squaresH, squaresV }: Pick<ShipLayoutRoom, 'squaresH' | 'squaresV'>,
  fileFormat: number,
): RoomState {
  const at = reader.offset
  const oxygen = reader.readInt()
  if (oxygen < 0 || oxygen > 100) {
    throw new ParseError(`Unsupported room oxygen: ${oxygen}`, at)
  }

  // On disk, squares run top to bottom in columns. Their ids run left to right
  // in rows, and that's the order to keep them in.
  const squares: SquareState[] = new Array(squaresH * squaresV)
  for (let h = 0; h < squaresH; h++) {
    for (let v = 0; v < squaresV; v++) {
      squares[v * squaresH + h] = readStruct(reader, SQUARE_FIELDS)
    }
  }

  let stationSquare = 0
  let stationDirection: RoomState['stationDirection'] = 'NONE'
  if (isAE(fileFormat)) {
    stationSquare = reader.readInt()

    const directionAt = reader.offset
    const flag = reader.readInt()
    stationDirection = STATION_DIRECTIONS[flag]
    if (!stationDirection) {
      throw new ParseError(`Unsupported room station direction flag: ${flag}`, directionAt)
    }
  }

  return { oxygen, squaresH, squaresV, squares, stationSquare, stationDirection }
}

function writeRoom(writer: BinaryWriter, room: RoomState, fileFormat: number): void {
  writer.writeInt(room.oxygen)

  const { squaresH, squaresV, squares } = room
  for (let h = 0; h < squaresH; h++) {
    for (let v = 0; v < squaresV; v++) {
      writeStruct(writer, SQUARE_FIELDS, squares[v * squaresH + h])
    }
  }

  if (isAE(fileFormat)) {
    writer.writeInt(room.stationSquare)
    writer.writeInt(STATION_DIRECTIONS.indexOf(room.stationDirection))
  }
}

function readDoor(
  reader: BinaryReader,
  coord: Pick<DoorState, 'wallX' | 'wallY' | 'vertical'>,
  fileFormat: number,
): DoorState {
  const ae = isAE(fileFormat)

  const health = ae
    ? readStruct(reader, DOOR_HEALTH_FIELDS)
    : blankStruct(DOOR_HEALTH_FIELDS)
  const state = readStruct(reader, DOOR_FIELDS)
  const tail = ae ? readStruct(reader, DOOR_AE_FIELDS) : blankStruct(DOOR_AE_FIELDS)

  return {
    wallX: coord.wallX,
    wallY: coord.wallY,
    vertical: coord.vertical,
    ...health,
    ...state,
    ...tail,
  }
}

function writeDoor(writer: BinaryWriter, door: DoorState, fileFormat: number): void {
  const ae = isAE(fileFormat)

  if (ae) writeStruct(writer, DOOR_HEALTH_FIELDS, door)
  writeStruct(writer, DOOR_FIELDS, door)
  if (ae) writeStruct(writer, DOOR_AE_FIELDS, door)
}

/**
 * Reads a ship, up to where its record stops.
 *
 * The rest of a ship lies much later in the file, past the sector, and is
 * picked up by readExtendedShipInfo. @see SaveParser.ts
 */
export function readShip(
  reader: BinaryReader,
  fileFormat: number,
  lookup: SaveLookup,
): ShipState {
  const ae = isAE(fileFormat)
  const at = reader.offset

  const ids = readStruct(reader, SHIP_ID_FIELDS)

  const blueprint = lookup.getShip(ids.blueprintId)
  if (!blueprint) {
    throw new ParseError(
      `The loaded game data has no blueprint for ship "${ids.blueprintId}" (${ids.name}). ` +
        `Was this save made with a mod, or a different FTL version?`,
      at,
    )
  }

  const layout = blueprint.layoutId ? lookup.getShipLayout(blueprint.layoutId) : undefined
  if (!layout) {
    throw new ParseError(
      `The loaded game data has no layout "${blueprint.layoutId}" for ship ` +
        `"${ids.blueprintId}" (${ids.name}). Was this save made with a mod, or a ` +
        `different FTL version?`,
      at,
    )
  }

  const startingCrew = readCount(reader, () => readStruct(reader, STARTING_CREW_FIELDS))

  const jump = ae ? readStruct(reader, SHIP_JUMP_FIELDS) : blankStruct(SHIP_JUMP_FIELDS)
  const supplies = readStruct(reader, SHIP_SUPPLY_FIELDS)
  const crew = readCount(reader, () => readCrewMember(reader, fileFormat))

  const reservePowerCapacity = reader.readInt()

  const systems: SystemState[] = []
  for (const type of systemTypesFor(fileFormat)) {
    systems.push(readSystem(reader, type, fileFormat))

    // A system in several rooms has a record for each, such as the flagship's
    // artillery.
    if (type === 'artillery') {
      const roomCount = blueprint.systemRooms.artillery?.length ?? 0
      for (let room = 1; room < roomCount; room++) {
        systems.push(readSystem(reader, type, fileFormat))
      }
    }
  }

  const ship: ShipState = {
    ...ids,
    ...jump,
    ...supplies,
    startingCrew,
    crew,
    reservePowerCapacity,
    systems,
    clonebay: null,
    battery: null,
    shields: null,
    cloaking: null,
    hacking: null,
    mind: null,
    artillery: [],
    rooms: [],
    breaches: [],
    doors: [],
    cloakAnimTicks: 0,
    lockdownCrystals: [],
    weapons: [],
    drones: [],
    augmentIds: [],
    standaloneDrones: [],
  }

  if (ae) {
    if (installedSystem(ship, 'clonebay')) {
      ship.clonebay = readStruct(reader, CLONEBAY_FIELDS)
    }
    if (installedSystem(ship, 'battery')) {
      ship.battery = readStruct(reader, BATTERY_FIELDS)
    }

    // The shields info always exists, even if the shields system doesn't.
    ship.shields = readStruct(reader, SHIELDS_FIELDS)

    if (installedSystem(ship, 'cloaking')) {
      ship.cloaking = readStruct(reader, CLOAKING_FIELDS)
    }
  }

  ship.rooms = layout.rooms.map((room) => readRoom(reader, room, fileFormat))

  ship.breaches = readCount(reader, () => ({
    x: reader.readInt(),
    y: reader.readInt(),
    health: reader.readInt(),
  }))

  ship.doors = layout.doors.map((door) => readDoor(reader, door, fileFormat))

  if (ae) ship.cloakAnimTicks = reader.readInt()

  if (hasFormat8Fields(fileFormat)) {
    ship.lockdownCrystals = readCount(reader, () =>
      readStruct(reader, LOCKDOWN_CRYSTAL_FIELDS),
    )
  }

  ship.weapons = readCount(reader, (): WeaponState => {
    const weaponId = reader.readString()
    const armed = reader.readBool()
    const cooldownTicks = fileFormat === 2 ? reader.readInt() : 0
    return { weaponId, armed, cooldownTicks, module: null }
  })

  ship.drones = readCount(reader, () => ({
    ...readStruct(reader, DRONE_FIELDS),
    extended: null,
  }))

  ship.augmentIds = readCount(reader, () => reader.readString())

  return ship
}

export function writeShip(
  writer: BinaryWriter,
  ship: ShipState,
  fileFormat: number,
): void {
  const ae = isAE(fileFormat)

  writeStruct(writer, SHIP_ID_FIELDS, ship)

  writer.writeInt(ship.startingCrew.length)
  for (const crew of ship.startingCrew) {
    writeStruct(writer, STARTING_CREW_FIELDS, crew)
  }

  if (ae) writeStruct(writer, SHIP_JUMP_FIELDS, ship)
  writeStruct(writer, SHIP_SUPPLY_FIELDS, ship)

  writer.writeInt(ship.crew.length)
  for (const crew of ship.crew) writeCrewMember(writer, crew, fileFormat)

  writer.writeInt(ship.reservePowerCapacity)

  for (const type of systemTypesFor(fileFormat)) {
    const records = ship.systems.filter((s) => s.type === type)
    if (records.length === 0) writer.writeInt(0) // A 0-capacity system.
    for (const system of records) writeSystem(writer, system, fileFormat)
  }

  if (ae) {
    if (installedSystem(ship, 'clonebay')) {
      writeStruct(writer, CLONEBAY_FIELDS, required(ship.clonebay, 'clonebay', ship))
    }
    if (installedSystem(ship, 'battery')) {
      writeStruct(writer, BATTERY_FIELDS, required(ship.battery, 'battery', ship))
    }

    writeStruct(writer, SHIELDS_FIELDS, required(ship.shields, 'shields', ship))

    if (installedSystem(ship, 'cloaking')) {
      writeStruct(writer, CLOAKING_FIELDS, required(ship.cloaking, 'cloaking', ship))
    }
  }

  for (const room of ship.rooms) writeRoom(writer, room, fileFormat)

  writer.writeInt(ship.breaches.length)
  for (const breach of ship.breaches) {
    writer.writeInt(breach.x)
    writer.writeInt(breach.y)
    writer.writeInt(breach.health)
  }

  for (const door of ship.doors) writeDoor(writer, door, fileFormat)

  if (ae) writer.writeInt(ship.cloakAnimTicks)

  if (hasFormat8Fields(fileFormat)) {
    writer.writeInt(ship.lockdownCrystals.length)
    for (const crystal of ship.lockdownCrystals) {
      writeStruct(writer, LOCKDOWN_CRYSTAL_FIELDS, crystal)
    }
  }

  writer.writeInt(ship.weapons.length)
  for (const weapon of ship.weapons) {
    writer.writeString(weapon.weaponId)
    writer.writeBool(weapon.armed)
    if (fileFormat === 2) writer.writeInt(weapon.cooldownTicks)
  }

  writer.writeInt(ship.drones.length)
  for (const drone of ship.drones) writeStruct(writer, DRONE_FIELDS, drone)

  writer.writeInt(ship.augmentIds.length)
  for (const augmentId of ship.augmentIds) writer.writeString(augmentId)
}

/** Fails loudly: a missing record here would shift everything after it. */
function required<T>(value: T | null | undefined, what: string, ship: ShipState): T {
  if (value === null || value === undefined) {
    throw new Error(`Ship "${ship.name}" has no ${what} information to write.`)
  }
  return value
}

function droneTypeOf(
  droneId: string,
  lookup: SaveLookup,
  at: number,
): DroneType {
  const blueprint = lookup.getDrone(droneId)
  if (!blueprint) {
    throw new ParseError(`The loaded game data has no drone "${droneId}"`, at)
  }

  const type = asDroneType(blueprint.type)
  if (!type) {
    throw new ParseError(
      `Drone "${droneId}" has an unrecognized type: ${blueprint.type}`,
      at,
    )
  }

  return type
}

function readReticle(reader: BinaryReader): XYPair {
  return { x: reader.readInt(), y: reader.readInt() }
}

function readWeaponModule(reader: BinaryReader, fileFormat: number): WeaponModuleState {
  const cooldown = readStruct(reader, WEAPON_COOLDOWN_FIELDS)
  const currentTargets = readCount(reader, () => readReticle(reader))
  const previousTargets = readCount(reader, () => readReticle(reader))
  const targeting = readStruct(reader, WEAPON_TARGETING_FIELDS)
  const weaponAnim = readAnim(reader)
  const firing = readStruct(reader, WEAPON_FIRING_FIELDS)

  let charging: WeaponModuleState['charging'] = null
  if (hasChargeAnim(fileFormat)) {
    const animCharge = reader.readInt()
    charging = { animCharge, chargeAnim: readAnim(reader) }
  }

  const lastProjectileId = reader.readInt()
  const pendingProjectiles = readCount(reader, () => readProjectile(reader, fileFormat))

  return {
    ...cooldown,
    ...targeting,
    ...firing,
    currentTargets,
    previousTargets,
    weaponAnim,
    charging,
    lastProjectileId,
    pendingProjectiles,
  }
}

function writeWeaponModule(
  writer: BinaryWriter,
  module: WeaponModuleState,
  fileFormat: number,
): void {
  const writeReticles = (reticles: XYPair[]) => {
    writer.writeInt(reticles.length)
    for (const reticle of reticles) {
      writer.writeInt(reticle.x)
      writer.writeInt(reticle.y)
    }
  }

  writeStruct(writer, WEAPON_COOLDOWN_FIELDS, module)
  writeReticles(module.currentTargets)
  writeReticles(module.previousTargets)
  writeStruct(writer, WEAPON_TARGETING_FIELDS, module)
  writeAnim(writer, module.weaponAnim)
  writeStruct(writer, WEAPON_FIRING_FIELDS, module)

  if (hasChargeAnim(fileFormat)) {
    if (!module.charging) throw new Error('A weapon module has no charge animation.')
    writer.writeInt(module.charging.animCharge)
    writeAnim(writer, module.charging.chargeAnim)
  }

  writer.writeInt(module.lastProjectileId)

  writer.writeInt(module.pendingProjectiles.length)
  for (const projectile of module.pendingProjectiles) {
    writeProjectile(writer, projectile, fileFormat)
  }
}

/**
 * Reads the part of a ship stored after the sector (FTL 1.5.4+).
 *
 * It adds to `ship` in place, and nothing else holds that object yet.
 */
export function readExtendedShipInfo(
  reader: BinaryReader,
  ship: ShipState,
  fileFormat: number,
  lookup: SaveLookup,
): void {
  // There is no count for drones: this runs off the list read earlier.
  for (const drone of ship.drones) {
    const at = reader.offset
    const flags = readStruct(reader, DRONE_EXTENDED_FIELDS)

    const droneType = droneTypeOf(drone.droneId, lookup, at)
    const pod = PODLESS_DRONE_TYPES.includes(droneType)
      ? null
      : readDronePod(reader, droneType)

    drone.extended = { ...flags, pod }
  }

  if (installedSystem(ship, 'hacking')) {
    const at = reader.offset
    const fields = readStruct(reader, HACKING_FIELDS)
    if (fields.targetSystem < -1 || fields.targetSystem >= SYSTEM_TYPES.length) {
      throw new ParseError(`Unsupported hacking target: ${fields.targetSystem}`, at)
    }

    ship.hacking = { ...fields, dronePod: readDronePod(reader, 'HACKING') }
  }

  if (installedSystem(ship, 'mind')) {
    ship.mind = readStruct(reader, MIND_FIELDS)
  }

  if (installedSystem(ship, 'weapons')) {
    const at = reader.offset
    const moduleCount = reader.readInt()
    if (moduleCount !== ship.weapons.length) {
      throw new ParseError(
        `Found ${moduleCount} weapon modules, but there are ${ship.weapons.length} weapons`,
        at,
      )
    }

    for (const weapon of ship.weapons) {
      weapon.module = readWeaponModule(reader, fileFormat)
    }
  }

  for (const system of ship.systems) {
    if (system.type === 'artillery' && system.capacity > 0) {
      ship.artillery.push(readWeaponModule(reader, fileFormat))
    }
  }

  ship.standaloneDrones = readCount(reader, () => {
    const at = reader.offset
    const droneId = reader.readString()
    const dronePod = readDronePod(reader, droneTypeOf(droneId, lookup, at))
    return {
      droneId,
      dronePod,
      ...readStruct(reader, STANDALONE_DRONE_TAIL_FIELDS),
    }
  })
}

export function writeExtendedShipInfo(
  writer: BinaryWriter,
  ship: ShipState,
  fileFormat: number,
): void {
  for (const drone of ship.drones) {
    const extended = required(drone.extended, `drone "${drone.droneId}"`, ship)
    writeStruct(writer, DRONE_EXTENDED_FIELDS, extended)
    if (extended.pod) writeDronePod(writer, extended.pod)
  }

  if (installedSystem(ship, 'hacking')) {
    const hacking = required(ship.hacking, 'hacking', ship)
    writeStruct(writer, HACKING_FIELDS, hacking)
    writeDronePod(writer, hacking.dronePod)
  }

  if (installedSystem(ship, 'mind')) {
    writeStruct(writer, MIND_FIELDS, required(ship.mind, 'mind control', ship))
  }

  if (installedSystem(ship, 'weapons')) {
    writer.writeInt(ship.weapons.length)
    for (const weapon of ship.weapons) {
      const module = required(weapon.module, `weapon "${weapon.weaponId}"`, ship)
      writeWeaponModule(writer, module, fileFormat)
    }
  }

  for (const module of ship.artillery) {
    writeWeaponModule(writer, module, fileFormat)
  }

  writer.writeInt(ship.standaloneDrones.length)
  for (const drone of ship.standaloneDrones) {
    writer.writeString(drone.droneId)
    writeDronePod(writer, drone.dronePod)
    writeStruct(writer, STANDALONE_DRONE_TAIL_FIELDS, drone)
  }
}
