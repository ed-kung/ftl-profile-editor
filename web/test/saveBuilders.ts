import { blankSystem, type SaveLookup } from '../src/lib/save/ship'
import { blankStruct } from '../src/lib/save/struct'
import {
  AE_TRANSIT_FIELDS,
  ANIM_FIELDS,
  ASTEROID_FIELD_FIELDS,
  BATTERY_FIELDS,
  BEACON_BACKGROUND_FIELDS,
  BEACON_ENEMY_FIELDS,
  BEAM_PROJECTILE_FIELDS,
  BOARDER_POD_FIELDS,
  BOMB_PROJECTILE_FIELDS,
  CLOAKING_FIELDS,
  CLONEBAY_FIELDS,
  CREW_AE_FIELDS,
  CREW_CRYSTAL_FIELDS,
  CREW_IDENTITY_FIELDS,
  CREW_MASTERY_FIELDS,
  CREW_SAVED_ROOM_FIELDS,
  CREW_SKILL_FIELDS,
  DAMAGE_FIELDS,
  DOOR_AE_FIELDS,
  DOOR_FIELDS,
  DOOR_HEALTH_FIELDS,
  DRONE_FIELDS,
  DRONE_POD_FIELDS,
  ENCOUNTER_EVENT_FIELDS,
  ENVIRONMENT_HAZARD_FIELDS,
  ENVIRONMENT_TICK_FIELDS,
  HACKING_FIELDS,
  HACKING_POD_FIELDS,
  LASER_PROJECTILE_FIELDS,
  LOCKDOWN_CRYSTAL_FIELDS,
  MIND_FIELDS,
  NEARBY_SHIP_AI_FIELDS,
  PDS_PROJECTILE_FIELDS,
  PROJECTILE_FLIGHT_FIELDS,
  PROJECTILE_OUTCOME_FIELDS,
  PROJECTILE_POSITION_FIELDS,
  PURSUIT_FIELDS,
  SESSION_FIELDS,
  SHIELDS_FIELDS,
  SHIELD_POD_FIELDS,
  SHIP_ID_FIELDS,
  SHIP_JUMP_FIELDS,
  SHIP_SUPPLY_FIELDS,
  SQUARE_FIELDS,
  STANDALONE_DRONE_TAIL_FIELDS,
  STORE_SUPPLY_FIELDS,
  SYSTEM_TYPES,
  WEAPON_COOLDOWN_FIELDS,
  WEAPON_FIRING_FIELDS,
  WEAPON_TARGETING_FIELDS,
  ZIGZAG_POD_FIELDS,
  isAE,
  type AnimState,
  type BeaconState,
  type CrewState,
  type DoorState,
  type DronePodExtra,
  type DronePodState,
  type DroneState,
  type LiveProjectile,
  type ProjectileExtra,
  type RoomState,
  type SavedGame,
  type ShipState,
  type SystemType,
  type WeaponModuleState,
} from '../src/lib/save/types'

export const anim = (): AnimState => blankStruct(ANIM_FIELDS)

/**
 * Hand-built saved games for tests that need no game install.
 *
 * Every field gets a distinct value through `seq`, so a mix-up between two
 * fields shows up as a difference rather than passing as 0 == 0.
 */

let next = 100
export function resetSeq(): void {
  next = 100
}

function seq<T extends Record<string, number | boolean | string>>(blank: T): T {
  const out = { ...blank } as Record<string, number | boolean | string>
  for (const key of Object.keys(out)) {
    const value = out[key]
    next++
    if (typeof value === 'number') out[key] = next
    else if (typeof value === 'boolean') out[key] = next % 2 === 0
    else out[key] = `s${next}`
  }
  return out as T
}

const seqAnim = () => seq(anim())

export const LAYOUT_TEXT = `X_OFFSET
1
Y_OFFSET
2
HORIZONTAL
3
VERTICAL
4
ELLIPSE
5
6
7
8
ROOM
0
1
1
2
1
ROOM
1
3
1
1
2
DOOR
3
1
0
1
1
DOOR
1
0
-1
0
0
DOOR
3
2
1
-1
1
`

const LAYOUT = {
  offsetX: 1,
  offsetY: 2,
  rooms: [
    { locationX: 1, locationY: 1, squaresH: 2, squaresV: 1 },
    { locationX: 3, locationY: 1, squaresH: 1, squaresV: 2 },
  ],
  doors: [
    { wallX: 3, wallY: 1, vertical: 1, roomIdA: 0, roomIdB: 1 },
    { wallX: 1, wallY: 0, vertical: 0, roomIdA: -1, roomIdB: 0 },
    { wallX: 3, wallY: 2, vertical: 1, roomIdA: 1, roomIdB: -1 },
  ],
}

const DRONE_TYPES_BY_ID: Record<string, string> = {
  D_BOARDER: 'BOARDER',
  D_HACKING: 'HACKING',
  D_COMBAT: 'COMBAT',
  D_BEAM: 'BEAM',
  D_DEFENSE: 'DEFENSE',
  D_SHIELD: 'SHIELD',
  D_SHIP_REPAIR: 'SHIP_REPAIR',
  D_BATTLE: 'BATTLE',
  D_REPAIR: 'REPAIR',
}

export const stubLookup: SaveLookup = {
  getShip: (id) => {
    const systemRooms: Record<string, number[]> = {}
    if (id === 'FLAGSHIP') systemRooms.artillery = [0, 1, 1]

    return id === 'SHIP' || id === 'FLAGSHIP'
      ? { layoutId: 'test', systemRooms }
      : undefined
  },
  getShipLayout: (id) => (id === 'test' ? LAYOUT : undefined),
  getDrone: (id) =>
    DRONE_TYPES_BY_ID[id] ? { type: DRONE_TYPES_BY_ID[id] } : undefined,
}

function crew(fileFormat: number, race: string): CrewState {
  const ae = isAE(fileFormat)
  return {
    ...seq(blankStruct(CREW_IDENTITY_FIELDS)),
    race,
    ...(ae ? seq(blankStruct(CREW_SAVED_ROOM_FIELDS)) : blankStruct(CREW_SAVED_ROOM_FIELDS)),
    ...seq(blankStruct(CREW_SKILL_FIELDS)),
    ...(ae ? seq(blankStruct(CREW_AE_FIELDS)) : blankStruct(CREW_AE_FIELDS)),
    ...(fileFormat >= 8
      ? seq(blankStruct(CREW_MASTERY_FIELDS))
      : blankStruct(CREW_MASTERY_FIELDS)),
    ...(ae && race === 'crystal'
      ? seq(blankStruct(CREW_CRYSTAL_FIELDS))
      : blankStruct(CREW_CRYSTAL_FIELDS)),
    cloneReady: ae ? 7 : 0,
    spriteTintIndeces: ae ? [1, 2, 3] : [],
    unknownNu: ae,
    teleportAnim: ae ? seqAnim() : anim(),
    unknownPhi: ae,
  }
}

function pod(extended: DronePodExtra): DronePodState {
  return { ...seq(blankStruct(DRONE_POD_FIELDS)), deathAnim: seqAnim(), extended }
}

function zigzagPod(): DronePodState {
  return pod({ extra: 'ZIGZAG', ...seq(blankStruct(ZIGZAG_POD_FIELDS)) })
}

function hackingPod(): DronePodState {
  return pod({
    extra: 'HACKING',
    ...seq(blankStruct(HACKING_POD_FIELDS)),
    landingAnim: seqAnim(),
    extensionAnim: seqAnim(),
  })
}

function drone(droneId: string, podState: DronePodState | null, ae: boolean): DroneState {
  return {
    ...seq(blankStruct(DRONE_FIELDS)),
    droneId,
    extended: ae ? { deployed: true, armed: false, pod: podState } : null,
  }
}

function everyProjectile(fileFormat: number): SavedGame['projectiles'] {
  const live = (
    kind: LiveProjectile['kind'],
    extended: ProjectileExtra,
  ): LiveProjectile => ({
    ...seq(blankStruct(PROJECTILE_POSITION_FIELDS)),
    ...seq(blankStruct(PROJECTILE_FLIGHT_FIELDS)),
    ...seq(blankStruct(PROJECTILE_OUTCOME_FIELDS)),
    kind,
    damage: seq(blankStruct(DAMAGE_FIELDS)),
    deathAnim: seqAnim(),
    flightAnim: seqAnim(),
    extended,
  })

  const list: SavedGame['projectiles'] = [
    { kind: 'INVALID' },
    live('LASER_OR_BURST', { extra: 'LASER', ...seq(blankStruct(LASER_PROJECTILE_FIELDS)) }),
    live('ROCK_OR_EXPLOSION', { extra: 'NONE' }),
    live('MISSILE', { extra: 'NONE' }),
    live('BOMB', { extra: 'BOMB', ...seq(blankStruct(BOMB_PROJECTILE_FIELDS)) }),
    live('BEAM', { extra: 'BEAM', ...seq(blankStruct(BEAM_PROJECTILE_FIELDS)) }),
  ]

  if (fileFormat === 11) {
    list.push(
      live('PDS', {
        extra: 'PDS',
        ...seq(blankStruct(PDS_PROJECTILE_FIELDS)),
        unknownZeta: seqAnim(),
      }),
    )
  }

  return list
}

function weaponModule(fileFormat: number): WeaponModuleState {
  return {
    ...seq(blankStruct(WEAPON_COOLDOWN_FIELDS)),
    ...seq(blankStruct(WEAPON_TARGETING_FIELDS)),
    ...seq(blankStruct(WEAPON_FIRING_FIELDS)),
    currentTargets: [{ x: 11, y: 12 }],
    previousTargets: [
      { x: 13, y: 14 },
      { x: 15, y: 16 },
    ],
    weaponAnim: seqAnim(),
    charging: fileFormat >= 9 ? { animCharge: 2, chargeAnim: seqAnim() } : null,
    lastProjectileId: 99,
    pendingProjectiles: everyProjectile(fileFormat),
  }
}

function room(fileFormat: number, squaresH: number, squaresV: number, direction: RoomState['stationDirection']): RoomState {
  const ae = isAE(fileFormat)
  const squares = []
  for (let i = 0; i < squaresH * squaresV; i++) squares.push(seq(blankStruct(SQUARE_FIELDS)))

  return {
    oxygen: 55,
    squaresH,
    squaresV,
    squares,
    stationSquare: ae ? 1 : 0,
    stationDirection: ae ? direction : 'NONE',
  }
}

function door(fileFormat: number, wallX: number, wallY: number, vertical: number): DoorState {
  const ae = isAE(fileFormat)
  return {
    wallX,
    wallY,
    vertical,
    ...(ae ? seq(blankStruct(DOOR_HEALTH_FIELDS)) : blankStruct(DOOR_HEALTH_FIELDS)),
    ...seq(blankStruct(DOOR_FIELDS)),
    ...(ae ? seq(blankStruct(DOOR_AE_FIELDS)) : blankStruct(DOOR_AE_FIELDS)),
  }
}

/**
 * A ship with every optional part.
 *
 * `installed` lists the systems to give capacity. `blueprintId` picks how many
 * artillery rooms the stub lookup reports.
 */
function ship(
  fileFormat: number,
  blueprintId: string,
  installed: readonly SystemType[],
): ShipState {
  const ae = isAE(fileFormat)
  const artilleryRecords = blueprintId === 'FLAGSHIP' ? 3 : 1
  const types = SYSTEM_TYPES.slice(0, ae ? SYSTEM_TYPES.length : 12)

  const systems = types.flatMap((type) => {
    const records = type === 'artillery' ? artilleryRecords : 1
    return Array.from({ length: records }, (_, i) => {
      const system = blankSystem(type)
      // Leaves a gap in a multi-room system, the awkward case for the writer.
      if (!installed.includes(type) || (type === 'artillery' && i === 1)) return system
      return { ...system, ...seq(system), type, capacity: 3 }
    })
  })

  if (!ae) {
    for (const system of systems) {
      system.batteryPower = 0
      system.hackLevel = 0
      system.hacked = false
      system.temporaryCapacityCap = 0
      system.temporaryCapacityLoss = 0
      system.temporaryCapacityDivisor = 0
    }
  }

  const has = (type: SystemType) => installed.includes(type)
  const module = () => (ae && has('weapons') ? weaponModule(fileFormat) : null)

  return {
    ...seq(blankStruct(SHIP_ID_FIELDS)),
    blueprintId,
    ...(ae ? seq(blankStruct(SHIP_JUMP_FIELDS)) : blankStruct(SHIP_JUMP_FIELDS)),
    ...seq(blankStruct(SHIP_SUPPLY_FIELDS)),
    startingCrew: [{ race: 'human', name: 'Starter' }],
    crew: [crew(fileFormat, 'human'), crew(fileFormat, 'crystal')],
    reservePowerCapacity: 20,
    systems,
    clonebay: ae && has('clonebay') ? seq(blankStruct(CLONEBAY_FIELDS)) : null,
    battery: ae && has('battery') ? seq(blankStruct(BATTERY_FIELDS)) : null,
    shields: ae ? seq(blankStruct(SHIELDS_FIELDS)) : null,
    cloaking: ae && has('cloaking') ? seq(blankStruct(CLOAKING_FIELDS)) : null,
    hacking:
      ae && has('hacking')
        ? { ...seq(blankStruct(HACKING_FIELDS)), targetSystem: 15, dronePod: hackingPod() }
        : null,
    mind: ae && has('mind') ? seq(blankStruct(MIND_FIELDS)) : null,
    artillery:
      ae && has('artillery')
        ? Array.from({ length: artilleryRecords - (artilleryRecords > 1 ? 1 : 0) }, () =>
            weaponModule(fileFormat),
          )
        : [],
    rooms: [room(fileFormat, 2, 1, 'UP'), room(fileFormat, 1, 2, 'LEFT')],
    breaches: [
      { x: 1, y: 1, health: 50 },
      { x: 1, y: 1, health: 60 }, // A repeat: must survive being rewritten.
    ],
    doors: LAYOUT.doors.map((d) => door(fileFormat, d.wallX, d.wallY, d.vertical)),
    cloakAnimTicks: ae ? 4 : 0,
    lockdownCrystals: fileFormat >= 8 ? [seq(blankStruct(LOCKDOWN_CRYSTAL_FIELDS))] : [],
    weapons: [
      { weaponId: 'W1', armed: true, cooldownTicks: fileFormat === 2 ? 5 : 0, module: module() },
      { weaponId: 'W2', armed: false, cooldownTicks: 0, module: module() },
    ],
    drones: [
      drone('D_BATTLE', null, ae),
      drone('D_REPAIR', null, ae),
      drone('D_COMBAT', zigzagPod(), ae),
      drone('D_BEAM', zigzagPod(), ae),
      drone('D_SHIP_REPAIR', zigzagPod(), ae),
      drone('D_DEFENSE', pod({ extra: 'NONE' }), ae),
      drone(
        'D_SHIELD',
        pod({ extra: 'SHIELD', ...seq(blankStruct(SHIELD_POD_FIELDS)) }),
        ae,
      ),
      drone(
        'D_BOARDER',
        pod({ extra: 'BOARDER', ...seq(blankStruct(BOARDER_POD_FIELDS)) }),
        ae,
      ),
      drone('D_HACKING', hackingPod(), ae),
    ],
    augmentIds: ['AUG_1', 'AUG_2'],
    standaloneDrones: ae
      ? [
          {
            droneId: 'D_COMBAT',
            dronePod: zigzagPod(),
            ...seq(blankStruct(STANDALONE_DRONE_TAIL_FIELDS)),
          },
        ]
      : [],
  }
}

function beacons(fileFormat: number): BeaconState[] {
  const blank = {
    ...blankStruct(BEACON_BACKGROUND_FIELDS),
    ...blankStruct(BEACON_ENEMY_FIELDS),
  }

  return [
    {
      ...blank,
      visitCount: 0,
      seen: false,
      enemyPresent: false,
      fleetPresence: 'NONE',
      underAttack: false,
      store: null,
    },
    {
      ...seq(blankStruct(BEACON_BACKGROUND_FIELDS)),
      ...seq(blankStruct(BEACON_ENEMY_FIELDS)),
      visitCount: 2,
      seen: true,
      enemyPresent: true,
      fleetPresence: 'BOTH',
      underAttack: true,
      store: {
        ...seq(blankStruct(STORE_SUPPLY_FIELDS)),
        shelves: [
          {
            itemType: 'SYSTEM',
            slots: [
              // The empty slot comes first, which Java's writer would not keep.
              null,
              { itemId: 'teleporter', available: true, extraData: fileFormat >= 8 ? 3 : 0 },
              { itemId: 'mind', available: false, extraData: 0 },
            ],
          },
          { itemType: 'CREW', slots: [null, null, null] },
        ],
      },
    },
  ]
}

export interface GameOptions {
  fileFormat: number
  nearbyShip?: boolean
  flagship?: boolean
  asteroids?: boolean
  installed?: readonly SystemType[]
}

export function buildGame({
  fileFormat,
  nearbyShip = true,
  flagship = false,
  asteroids = true,
  installed = SYSTEM_TYPES,
}: GameOptions): SavedGame {
  resetSeq()

  const ae = isAE(fileFormat)
  const transit = blankStruct(AE_TRANSIT_FIELDS)

  const nearby = nearbyShip
    ? ship(fileFormat, flagship ? 'FLAGSHIP' : 'SHIP', installed)
    : null

  if (ae) {
    Object.assign(transit, seq(transit))
  } else {
    transit.currentBeaconId = 4
    transit.sectorHazardsVisible = true
    transit.rebelFlagshipHop = 2
    transit.rebelFlagshipMoving = true
  }

  return {
    ...seq(blankStruct(SESSION_FIELDS)),
    ...seq(blankStruct(PURSUIT_FIELDS)),
    ...transit,
    fileFormat,
    randomNative: fileFormat === 11 ? false : true,
    dlcEnabled: ae,
    difficulty: ae ? 'HARD' : 'NORMAL',
    unknownBeta: 0,
    stateVars: [
      { id: 'blue_alien', value: 1 },
      { id: 'env_danger', value: 3 },
    ],
    playerShip: ship(fileFormat, 'SHIP', installed),
    cargoIds: ['CARGO_A', 'CARGO_B'],
    sectorVisitation: [true, false, true],
    sectorNumber: 4,
    sectorIsHiddenCrystalWorlds: true,
    beacons: beacons(fileFormat),
    questEvents: [{ eventId: 'QUEST', beaconId: 2 }],
    distantQuestEventIds: ['DISTANT'],
    unknownMu: ae ? 8 : 0,
    encounter: ae
      ? {
          ...seq(blankStruct(ENCOUNTER_EVENT_FIELDS)),
          unknownAlpha: fileFormat === 11 ? 9 : 0,
          text: 'An encounter',
          affectedCrewSeed: 10,
          choices: [0, 1],
        }
      : null,
    rebelFlagshipNearby: ae && nearbyShip && flagship,
    nearbyShip: nearby,
    nearbyShipAI: ae && nearbyShip ? seq(blankStruct(NEARBY_SHIP_AI_FIELDS)) : null,
    environment: ae
      ? {
          ...seq(blankStruct(ENVIRONMENT_HAZARD_FIELDS)),
          ...seq(blankStruct(ENVIRONMENT_TICK_FIELDS)),
          vulnerableShips: 'BOTH_SHIPS',
          asteroidField: asteroids ? seq(blankStruct(ASTEROID_FIELD_FIELDS)) : null,
        }
      : null,
    projectiles: ae ? everyProjectile(fileFormat) : [],
    unknownNu: ae ? 21 : 0,
    unknownXi: ae && nearbyShip ? 22 : null,
    autofire: ae,
    rebelFlagship: {
      unknownAlpha: ae ? 31 : 0,
      pendingStage: 2,
      unknownGamma: ae ? 33 : 0,
      unknownDelta: ae ? 34 : 0,
      occupancy: [1, 0, 2],
    },
  }
}
