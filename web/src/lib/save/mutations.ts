import type { ShipLayout } from '../data/shipLayout'
import { blankSystem, installedSystem } from './ship'
import { blankStruct } from './struct'
import {
  ANIM_FIELDS,
  BOARDER_POD_FIELDS,
  CLOAKING_FIELDS,
  CLONEBAY_FIELDS,
  CREW_AE_FIELDS,
  CREW_CRYSTAL_FIELDS,
  CREW_IDENTITY_FIELDS,
  CREW_MASTERY_FIELDS,
  CREW_RACES,
  CREW_SAVED_ROOM_FIELDS,
  CREW_SKILL_FIELDS,
  DRONE_FIELDS,
  DRONE_POD_FIELDS,
  HACKING_FIELDS,
  HACKING_POD_FIELDS,
  MIND_FIELDS,
  PODLESS_DRONE_TYPES,
  WEAPON_COOLDOWN_FIELDS,
  WEAPON_FIRING_FIELDS,
  WEAPON_TARGETING_FIELDS,
  ZIGZAG_POD_FIELDS,
  asDroneType,
  type AnimState,
  type CrewState,
  type DronePodExtra,
  type DronePodState,
  type DroneState,
  type DroneType,
  type HackingInfo,
  type ShipState,
  type SystemState,
  type SystemType,
  type WeaponModuleState,
} from './types'

/**
 * Edits that change a saved game's structure.
 *
 * Much of the file has no counts or markers: what comes next is decided by
 * something stored earlier, such as a system's capacity or a drone's type. So
 * these edits must add or remove the matching records together, or everything
 * after them would be read as something else.
 *
 * New records use the defaults of the Java editor's state classes.
 * Every function returns a new ship and leaves its input alone.
 */

const INT_MIN = -2147483648
const INT_MAX = 2147483647

/** The game's own size for a floor square, in pixels. */
const SQUARE_SIZE = 35

export function newAnim(): AnimState {
  return { ...blankStruct(ANIM_FIELDS), scale: 1000, x: -1000, y: -1000 }
}

function newPodExtra(droneType: DroneType): DronePodExtra {
  switch (droneType) {
    case 'BOARDER':
      return {
        extra: 'BOARDER',
        ...blankStruct(BOARDER_POD_FIELDS),
        bodyHealth: 1,
        bodyX: -1,
        bodyY: -1,
        bodyRoomId: -1,
        bodyRoomSquare: -1,
      }
    case 'HACKING':
      return {
        extra: 'HACKING',
        ...blankStruct(HACKING_POD_FIELDS),
        landingAnim: newAnim(),
        extensionAnim: newAnim(),
      }
    case 'COMBAT':
    case 'BEAM':
    case 'SHIP_REPAIR':
      return { extra: 'ZIGZAG', ...blankStruct(ZIGZAG_POD_FIELDS) }
    case 'SHIELD':
      return { extra: 'SHIELD', unknownAlpha: -1000 }
    case 'DEFENSE':
    case 'BATTLE':
    case 'REPAIR':
      return { extra: 'NONE' }
  }
}

export function newDronePod(droneType: DroneType): DronePodState {
  return {
    ...blankStruct(DRONE_POD_FIELDS),
    destinationSpace: -1,
    unknownEpsilon: INT_MIN,
    unknownZeta: INT_MIN,
    nextTargetX: INT_MIN,
    nextTargetY: INT_MIN,
    unknownIota: INT_MIN,
    unknownKappa: INT_MIN,
    buildupTicks: -1000,
    hopsToLive: INT_MAX,
    unknownTau: -1000,
    deathAnim: newAnim(),
    extended: newPodExtra(droneType),
  }
}

export function newWeaponModule(fileFormat: number): WeaponModuleState {
  return {
    ...blankStruct(WEAPON_COOLDOWN_FIELDS),
    ...blankStruct(WEAPON_TARGETING_FIELDS),
    ...blankStruct(WEAPON_FIRING_FIELDS),
    targetId: -1,
    currentTargets: [],
    previousTargets: [],
    weaponAnim: newAnim(),
    charging: fileFormat >= 9 ? { animCharge: -1, chargeAnim: newAnim() } : null,
    lastProjectileId: -1,
    pendingProjectiles: [],
  }
}

function newHackingInfo(): HackingInfo {
  return {
    ...blankStruct(HACKING_FIELDS),
    targetSystem: -1,
    disruptionTicksGoal: 10000,
    dronePod: newDronePod('HACKING'),
  }
}

/** What a system holds beyond the common fields, in its uninstalled state. */
function withSystemInfo(
  ship: ShipState,
  type: SystemType,
  installed: boolean,
  fileFormat: number,
): ShipState {
  switch (type) {
    case 'clonebay':
      return { ...ship, clonebay: installed ? blankStruct(CLONEBAY_FIELDS) : null }
    case 'battery':
      return {
        ...ship,
        battery: installed
          ? { active: false, usedBattery: 0, dischargeTicks: 1000 }
          : null,
      }
    case 'cloaking':
      return {
        ...ship,
        cloaking: installed
          ? { ...blankStruct(CLOAKING_FIELDS), cloakTicks: INT_MIN }
          : null,
      }
    case 'hacking':
      return { ...ship, hacking: installed ? newHackingInfo() : null }
    case 'mind':
      return { ...ship, mind: installed ? blankStruct(MIND_FIELDS) : null }
    case 'weapons':
      return {
        ...ship,
        weapons: ship.weapons.map((weapon) => ({
          ...weapon,
          module: installed ? newWeaponModule(fileFormat) : null,
        })),
      }
    default:
      return ship
  }
}

/**
 * Sets a system's level, installing or removing it as needed.
 *
 * @param systemIndex a position in ship.systems: artillery can have several
 */
export function setSystemCapacity(
  ship: ShipState,
  systemIndex: number,
  capacity: number,
  fileFormat: number,
): ShipState {
  const system = ship.systems[systemIndex]
  const wasInstalled = system.capacity > 0
  const installed = capacity > 0

  let updated: SystemState
  if (!installed) {
    updated = blankSystem(system.type)
  } else if (wasInstalled) {
    updated = {
      ...system,
      capacity,
      power: Math.min(system.power, capacity),
      damagedBars: Math.min(system.damagedBars, capacity),
      ionizedBars: Math.min(system.ionizedBars, capacity),
    }
  } else {
    updated = {
      ...blankSystem(system.type),
      capacity,
      deionizationTicks: INT_MIN,
      temporaryCapacityCap: 1000,
      temporaryCapacityDivisor: 1,
    }
  }

  const systems = ship.systems.map((s, i) => (i === systemIndex ? updated : s))
  const next: ShipState = { ...ship, systems }

  if (installed === wasInstalled) return next

  if (system.type === 'artillery') {
    // Modules line up with the installed records, gaps skipped.
    const position = ship.systems
      .slice(0, systemIndex)
      .filter((s) => s.type === 'artillery' && s.capacity > 0).length

    const artillery = [...ship.artillery]
    if (installed) artillery.splice(position, 0, newWeaponModule(fileFormat))
    else artillery.splice(position, 1)

    return { ...next, artillery }
  }

  // A system with several records keeps its info while any is installed.
  if (!installed && installedSystem(next, system.type)) return next

  return withSystemInfo(next, system.type, installed, fileFormat)
}

export function addWeapon(
  ship: ShipState,
  weaponId: string,
  fileFormat: number,
): ShipState {
  const module = installedSystem(ship, 'weapons') ? newWeaponModule(fileFormat) : null
  return {
    ...ship,
    weapons: [...ship.weapons, { weaponId, armed: false, cooldownTicks: 0, module }],
  }
}

export function removeWeapon(ship: ShipState, index: number): ShipState {
  return { ...ship, weapons: ship.weapons.filter((_, i) => i !== index) }
}

/** The drone's type as the game data has it. @throws for an unknown type */
function requireDroneType(droneId: string, type: string | null | undefined): DroneType {
  const droneType = asDroneType(type)
  if (!droneType) {
    throw new Error(`Drone "${droneId}" has an unrecognized type: ${type}`)
  }
  return droneType
}

function podFor(droneType: DroneType): DronePodState | null {
  return PODLESS_DRONE_TYPES.includes(droneType) ? null : newDronePod(droneType)
}

function newDrone(droneId: string, droneType: DroneType): DroneState {
  return {
    ...blankStruct(DRONE_FIELDS),
    droneId,
    bodyX: -1,
    bodyY: -1,
    bodyRoomId: -1,
    bodyRoomSquare: -1,
    health: 1,
    extended: { deployed: false, armed: false, pod: podFor(droneType) },
  }
}

export function addDrone(
  ship: ShipState,
  droneId: string,
  droneTypeId: string | null | undefined,
): ShipState {
  const drone = newDrone(droneId, requireDroneType(droneId, droneTypeId))
  return { ...ship, drones: [...ship.drones, drone] }
}

/**
 * Swaps a drone for another.
 *
 * The drone comes back undeployed: a pod in flight can't change its shape.
 */
export function replaceDrone(
  ship: ShipState,
  index: number,
  droneId: string,
  droneTypeId: string | null | undefined,
): ShipState {
  const drone = newDrone(droneId, requireDroneType(droneId, droneTypeId))
  return {
    ...ship,
    drones: ship.drones.map((d, i) => (i === index ? drone : d)),
  }
}

export function removeDrone(ship: ShipState, index: number): ShipState {
  return { ...ship, drones: ship.drones.filter((_, i) => i !== index) }
}

interface CrewPlacement {
  roomId: number
  roomSquare: number
  spriteX: number
  spriteY: number
}

/**
 * The first floor square with nobody on it.
 *
 * @param avoidRooms rooms to skip, such as those whose squares are blocked
 */
export function findFreeSquare(
  ship: ShipState,
  layout: ShipLayout,
  avoidRooms: number[],
): CrewPlacement | null {
  const taken = new Set(ship.crew.map((c) => `${c.roomId},${c.roomSquare}`))

  for (const [roomId, room] of layout.rooms.entries()) {
    if (avoidRooms.includes(roomId)) continue

    const squareCount = room.squaresH * room.squaresV
    for (let roomSquare = 0; roomSquare < squareCount; roomSquare++) {
      if (taken.has(`${roomId},${roomSquare}`)) continue

      const column = roomSquare % room.squaresH
      const row = Math.floor(roomSquare / room.squaresH)
      const middle = Math.floor(SQUARE_SIZE / 2)

      return {
        roomId,
        roomSquare,
        spriteX: (layout.offsetX + room.locationX + column) * SQUARE_SIZE + middle,
        spriteY: (layout.offsetY + room.locationY + row) * SQUARE_SIZE + middle,
      }
    }
  }

  return null
}

export function newCrew(race: string, placement: CrewPlacement): CrewState {
  return {
    ...blankStruct(CREW_IDENTITY_FIELDS),
    ...blankStruct(CREW_SAVED_ROOM_FIELDS),
    ...blankStruct(CREW_SKILL_FIELDS),
    ...blankStruct(CREW_AE_FIELDS),
    ...blankStruct(CREW_MASTERY_FIELDS),
    ...blankStruct(CREW_CRYSTAL_FIELDS),
    ...placement,
    name: 'Frank',
    race,
    health: CREW_RACES[race]?.maxHealth ?? 100,
    playerControlled: true,
    savedRoomId: placement.roomId,
    savedRoomSquare: placement.roomSquare,
    male: true,
    clonebayPriority: -1,
    damageBoost: 1000,
    cloneReady: 0,
    spriteTintIndeces: [],
    unknownNu: false,
    teleportAnim: newAnim(),
    unknownPhi: false,
  }
}

export function removeCrew(ship: ShipState, index: number): ShipState {
  return { ...ship, crew: ship.crew.filter((_, i) => i !== index) }
}
