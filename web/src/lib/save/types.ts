import type { Difficulty } from '../profile/types'
import type { StructOf } from './struct'

/**
 * The contents of a saved game ("continue.sav").
 *
 * Mirrors net.blerf.ftl.parser.SavedGameParser's state classes, keeping their
 * field names so the two can be read side by side. "unknownAlpha" and friends
 * are fields nobody has worked out: they are kept so they can be written back.
 *
 * The *_FIELDS tables list values in file order. @see struct.ts
 */

/** The saved-game file formats, and the FTL versions that wrote them. */
export const SAVE_FORMAT_LABELS: Record<number, string> = {
  2: 'FTL 1.01–1.03.3',
  7: 'FTL 1.5.4–1.5.10',
  8: 'FTL 1.5.12',
  9: 'FTL 1.5.13',
  11: 'FTL 1.6.1+',
}

/** Whether a format has the fields Advanced Edition added. */
export const isAE = (fileFormat: number): boolean => fileFormat >= 7

// Enums. Where a list is written as a number, the position is that number.

/** In the order a ship's systems are stored; a hacking target is an index. */
export const SYSTEM_TYPES = [
  'shields',
  'engines',
  'oxygen',
  'weapons',
  'drones',
  'medbay',
  'pilot',
  'sensors',
  'doors',
  'teleporter',
  'cloaking',
  'artillery',
  'battery',
  'clonebay',
  'mind',
  'hacking',
] as const
export type SystemType = (typeof SYSTEM_TYPES)[number]

/** The systems that exist before FTL 1.5.4, a prefix of SYSTEM_TYPES. */
export const ORIGINAL_SYSTEM_COUNT = 12

export const DIFFICULTY_FLAGS: Difficulty[] = ['EASY', 'NORMAL', 'HARD']

export const FLEET_PRESENCES = ['NONE', 'REBEL', 'FEDERATION', 'BOTH'] as const
export type FleetPresence = (typeof FLEET_PRESENCES)[number]

export const STORE_ITEM_TYPES = ['WEAPON', 'DRONE', 'AUGMENT', 'CREW', 'SYSTEM'] as const
export type StoreItemType = (typeof STORE_ITEM_TYPES)[number]

export const STATION_DIRECTIONS = ['DOWN', 'RIGHT', 'UP', 'LEFT', 'NONE'] as const
export type StationDirection = (typeof STATION_DIRECTIONS)[number]

export const HAZARD_VULNERABILITIES = ['PLAYER_SHIP', 'NEARBY_SHIP', 'BOTH_SHIPS'] as const
export type HazardVulnerability = (typeof HAZARD_VULNERABILITIES)[number]

export const PROJECTILE_KINDS = [
  'INVALID',
  'LASER_OR_BURST',
  'ROCK_OR_EXPLOSION',
  'MISSILE',
  'BOMB',
  'BEAM',
  'PDS',
] as const
export type ProjectileKind = (typeof PROJECTILE_KINDS)[number]

export const DRONE_TYPES = [
  'BATTLE',
  'REPAIR',
  'BOARDER',
  'HACKING',
  'COMBAT',
  'BEAM',
  'DEFENSE',
  'SHIELD',
  'SHIP_REPAIR',
] as const
export type DroneType = (typeof DRONE_TYPES)[number]

/** Drones that walk the ship's interior, and so have no pod outside it. */
export const PODLESS_DRONE_TYPES: readonly DroneType[] = ['BATTLE', 'REPAIR']

export function asDroneType(id: string | null | undefined): DroneType | null {
  return (DRONE_TYPES as readonly (string | null | undefined)[]).includes(id)
    ? (id as DroneType)
    : null
}

/** Maximum health by race. Races in the file aren't limited to these. */
export const CREW_RACES: Record<string, { maxHealth: number }> = {
  anaerobic: { maxHealth: 100 },
  battle: { maxHealth: 150 },
  crystal: { maxHealth: 120 },
  energy: { maxHealth: 70 },
  engi: { maxHealth: 100 },
  ghost: { maxHealth: 50 },
  human: { maxHealth: 100 },
  mantis: { maxHealth: 100 },
  rock: { maxHealth: 150 },
  slug: { maxHealth: 100 },
}

// Shared.

export const ANIM_FIELDS = {
  playing: 'bool',
  looping: 'bool',
  currentFrame: 'int',
  progressTicks: 'int',
  scale: 'int',
  x: 'int',
  y: 'int',
} as const
export type AnimState = StructOf<typeof ANIM_FIELDS>

export interface XYPair {
  x: number
  y: number
}

// Crew.

export const STARTING_CREW_FIELDS = { race: 'string', name: 'string' } as const
export type StartingCrewState = StructOf<typeof STARTING_CREW_FIELDS>

export const CREW_IDENTITY_FIELDS = {
  name: 'string',
  race: 'string',
  enemyBoardingDrone: 'bool',
  health: 'int',
  spriteX: 'int',
  spriteY: 'int',
  roomId: 'int',
  roomSquare: 'int',
  playerControlled: 'bool',
} as const

export const CREW_SAVED_ROOM_FIELDS = {
  mindControlled: 'bool',
  savedRoomSquare: 'int',
  savedRoomId: 'int',
} as const

export const CREW_SKILL_FIELDS = {
  pilotSkill: 'int',
  engineSkill: 'int',
  shieldSkill: 'int',
  weaponSkill: 'int',
  repairSkill: 'int',
  combatSkill: 'int',
  male: 'bool',
  repairs: 'int',
  combatKills: 'int',
  pilotedEvasions: 'int',
  jumpsSurvived: 'int',
  skillMasteriesEarned: 'int',
} as const

export const CREW_AE_FIELDS = {
  stunTicks: 'int',
  healthBoost: 'int',
  clonebayPriority: 'int',
  damageBoost: 'int',
  unknownLambda: 'int',
  universalDeathCount: 'int',
} as const

/** FTL 1.5.12+. */
export const CREW_MASTERY_FIELDS = {
  pilotMasteryOne: 'bool',
  pilotMasteryTwo: 'bool',
  engineMasteryOne: 'bool',
  engineMasteryTwo: 'bool',
  shieldMasteryOne: 'bool',
  shieldMasteryTwo: 'bool',
  weaponMasteryOne: 'bool',
  weaponMasteryTwo: 'bool',
  repairMasteryOne: 'bool',
  repairMasteryTwo: 'bool',
  combatMasteryOne: 'bool',
  combatMasteryTwo: 'bool',
} as const

/** Only present on crystal crew. */
export const CREW_CRYSTAL_FIELDS = {
  lockdownRechargeTicks: 'int',
  lockdownRechargeTicksGoal: 'int',
  unknownOmega: 'int',
} as const

export type CrewState = StructOf<typeof CREW_IDENTITY_FIELDS> &
  StructOf<typeof CREW_SAVED_ROOM_FIELDS> &
  StructOf<typeof CREW_SKILL_FIELDS> &
  StructOf<typeof CREW_AE_FIELDS> &
  StructOf<typeof CREW_MASTERY_FIELDS> &
  StructOf<typeof CREW_CRYSTAL_FIELDS> & {
    cloneReady: number
    spriteTintIndeces: number[]
    unknownNu: boolean
    teleportAnim: AnimState
    unknownPhi: boolean
  }

// Systems.

export const SYSTEM_FIELDS = {
  power: 'int',
  damagedBars: 'int',
  ionizedBars: 'int',
  deionizationTicks: 'int',
  repairProgress: 'int',
  damageProgress: 'int',
} as const

export const SYSTEM_AE_FIELDS = {
  batteryPower: 'int',
  hackLevel: 'int',
  hacked: 'bool',
  temporaryCapacityCap: 'int',
  temporaryCapacityLoss: 'int',
  temporaryCapacityDivisor: 'int',
} as const

/** A capacity of 0 means the system isn't installed, and has no other fields. */
export type SystemState = StructOf<typeof SYSTEM_FIELDS> &
  StructOf<typeof SYSTEM_AE_FIELDS> & { type: SystemType; capacity: number }

export const CLONEBAY_FIELDS = {
  buildTicks: 'int',
  buildTicksGoal: 'int',
  doomTicks: 'int',
} as const
export type ClonebayInfo = StructOf<typeof CLONEBAY_FIELDS>

export const BATTERY_FIELDS = {
  active: 'bool',
  usedBattery: 'int',
  dischargeTicks: 'int',
} as const
export type BatteryInfo = StructOf<typeof BATTERY_FIELDS>

export const SHIELDS_FIELDS = {
  shieldLayers: 'int',
  energyShieldLayers: 'int',
  energyShieldMax: 'int',
  shieldRechargeTicks: 'int',
  shieldDropAnimOn: 'bool',
  shieldDropAnimTicks: 'int',
  shieldRaiseAnimOn: 'bool',
  shieldRaiseAnimTicks: 'int',
  energyShieldAnimOn: 'bool',
  energyShieldAnimTicks: 'int',
  unknownLambda: 'int',
  unknownMu: 'int',
} as const
export type ShieldsInfo = StructOf<typeof SHIELDS_FIELDS>

export const CLOAKING_FIELDS = {
  unknownAlpha: 'int',
  unknownBeta: 'int',
  cloakTicksGoal: 'int',
  cloakTicks: 'int',
} as const
export type CloakingInfo = StructOf<typeof CLOAKING_FIELDS>

export const HACKING_FIELDS = {
  /** An index into SYSTEM_TYPES, or -1 for none. */
  targetSystem: 'int',
  unknownBeta: 'int',
  dronePodVisible: 'bool',
  unknownDelta: 'int',
  disruptionTicks: 'int',
  disruptionTicksGoal: 'int',
  disrupting: 'bool',
} as const
export type HackingInfo = StructOf<typeof HACKING_FIELDS> & { dronePod: DronePodState }

export const MIND_FIELDS = {
  mindControlTicks: 'int',
  mindControlTicksGoal: 'int',
} as const
export type MindInfo = StructOf<typeof MIND_FIELDS>

// Rooms and doors.

export const SQUARE_FIELDS = {
  fireHealth: 'int',
  ignitionProgress: 'int',
  extinguishmentProgress: 'int',
} as const
export type SquareState = StructOf<typeof SQUARE_FIELDS>

export interface RoomState {
  oxygen: number
  /** The room's size, copied from the layout so writing needs no game data. */
  squaresH: number
  squaresV: number
  /** Left to right, top to bottom. The index is the square's id. */
  squares: SquareState[]
  stationSquare: number
  stationDirection: StationDirection
}

export interface BreachState {
  x: number
  y: number
  health: number
}

export const DOOR_HEALTH_FIELDS = {
  currentMaxHealth: 'int',
  health: 'int',
  nominalHealth: 'int',
} as const
export const DOOR_FIELDS = { open: 'bool', walkingThrough: 'bool' } as const
export const DOOR_AE_FIELDS = { unknownDelta: 'int', unknownEpsilon: 'int' } as const

export type DoorState = StructOf<typeof DOOR_HEALTH_FIELDS> &
  StructOf<typeof DOOR_FIELDS> &
  StructOf<typeof DOOR_AE_FIELDS> & {
    wallX: number
    wallY: number
    vertical: number
  }

export const LOCKDOWN_CRYSTAL_FIELDS = {
  currentPositionX: 'int',
  currentPositionY: 'int',
  speed: 'int',
  goalPositionX: 'int',
  goalPositionY: 'int',
  arrived: 'bool',
  done: 'bool',
  lifetime: 'int',
  superFreeze: 'bool',
  lockingRoom: 'int',
  animDirection: 'int',
  shardProgress: 'int',
} as const
export type LockdownCrystal = StructOf<typeof LOCKDOWN_CRYSTAL_FIELDS>

// Projectiles.

export const DAMAGE_FIELDS = {
  hullDamage: 'int',
  shieldPiercing: 'int',
  fireChance: 'int',
  breachChance: 'int',
  ionDamage: 'int',
  systemDamage: 'int',
  personnelDamage: 'int',
  hullBuster: 'bool',
  ownerId: 'int',
  selfId: 'int',
  lockdown: 'bool',
  crystalShard: 'bool',
  stunChance: 'int',
  stunAmount: 'int',
} as const
export type DamageState = StructOf<typeof DAMAGE_FIELDS>

export const PROJECTILE_POSITION_FIELDS = {
  currentPositionX: 'int',
  currentPositionY: 'int',
  previousPositionX: 'int',
  previousPositionY: 'int',
  speed: 'int',
  goalPositionX: 'int',
  goalPositionY: 'int',
  heading: 'int',
  ownerId: 'int',
  selfId: 'int',
} as const

export const PROJECTILE_FLIGHT_FIELDS = {
  lifespan: 'int',
  destinationSpace: 'int',
  currentSpace: 'int',
  targetId: 'int',
  dead: 'bool',
  deathAnimId: 'string',
  flightAnimId: 'string',
} as const

export const PROJECTILE_OUTCOME_FIELDS = {
  velocityX: 'int',
  velocityY: 'int',
  missed: 'bool',
  hitTarget: 'bool',
  hitSolidSound: 'string',
  hitShieldSound: 'string',
  missSound: 'string',
  entryAngle: 'int',
  startedDying: 'bool',
  passedTarget: 'bool',
  type: 'int',
  broadcastTarget: 'bool',
} as const

export const LASER_PROJECTILE_FIELDS = { unknownAlpha: 'int', spin: 'int' } as const

export const BOMB_PROJECTILE_FIELDS = {
  unknownAlpha: 'int',
  fuseTicks: 'int',
  unknownGamma: 'int',
  unknownDelta: 'int',
  arrived: 'bool',
} as const

export const BEAM_PROJECTILE_FIELDS = {
  emissionEndX: 'int',
  emissionEndY: 'int',
  strafeSourceX: 'int',
  strafeSourceY: 'int',
  strafeEndX: 'int',
  strafeEndY: 'int',
  unknownBetaX: 'int',
  unknownBetaY: 'int',
  swathEndX: 'int',
  swathEndY: 'int',
  swathStartX: 'int',
  swathStartY: 'int',
  unknownGamma: 'int',
  swathLength: 'int',
  unknownDelta: 'int',
  unknownEpsilonX: 'int',
  unknownEpsilonY: 'int',
  unknownZeta: 'int',
  unknownEta: 'int',
  emissionAngle: 'int',
  unknownIota: 'bool',
  unknownKappa: 'bool',
  fromDronePod: 'bool',
  unknownMu: 'bool',
  unknownNu: 'bool',
} as const

export const PDS_PROJECTILE_FIELDS = {
  unknownAlpha: 'int',
  unknownBeta: 'int',
  unknownGamma: 'int',
  unknownDelta: 'int',
  unknownEpsilon: 'int',
} as const

export type ProjectileExtra =
  | ({ extra: 'LASER' } & StructOf<typeof LASER_PROJECTILE_FIELDS>)
  | ({ extra: 'BOMB' } & StructOf<typeof BOMB_PROJECTILE_FIELDS>)
  | ({ extra: 'BEAM' } & StructOf<typeof BEAM_PROJECTILE_FIELDS>)
  | ({ extra: 'PDS'; unknownZeta: AnimState } & StructOf<typeof PDS_PROJECTILE_FIELDS>)
  | { extra: 'NONE' }

export type LiveProjectile = StructOf<typeof PROJECTILE_POSITION_FIELDS> &
  StructOf<typeof PROJECTILE_FLIGHT_FIELDS> &
  StructOf<typeof PROJECTILE_OUTCOME_FIELDS> & {
    kind: Exclude<ProjectileKind, 'INVALID'>
    damage: DamageState
    deathAnim: AnimState
    flightAnim: AnimState
    extended: ProjectileExtra
  }

/** An INVALID projectile is the flag alone. */
export type ProjectileState = { kind: 'INVALID' } | LiveProjectile

// Weapons and drones.

export const WEAPON_COOLDOWN_FIELDS = {
  cooldownTicks: 'int',
  cooldownTicksGoal: 'int',
  subcooldownTicks: 'int',
  subcooldownTicksGoal: 'int',
  boost: 'int',
  charge: 'int',
} as const

export const WEAPON_TARGETING_FIELDS = {
  autofire: 'bool',
  fireWhenReady: 'bool',
  targetId: 'int',
} as const

export const WEAPON_FIRING_FIELDS = {
  protractAnimTicks: 'int',
  firing: 'bool',
  unknownPhi: 'bool',
} as const

export type WeaponModuleState = StructOf<typeof WEAPON_COOLDOWN_FIELDS> &
  StructOf<typeof WEAPON_TARGETING_FIELDS> &
  StructOf<typeof WEAPON_FIRING_FIELDS> & {
    currentTargets: XYPair[]
    previousTargets: XYPair[]
    weaponAnim: AnimState
    /** FTL 1.5.13+. */
    charging: { animCharge: number; chargeAnim: AnimState } | null
    lastProjectileId: number
    pendingProjectiles: ProjectileState[]
  }

export interface WeaponState {
  weaponId: string
  armed: boolean
  /** FTL 1.03.3 and earlier only. */
  cooldownTicks: number
  /** FTL 1.5.4+, when the ship has a weapons system. */
  module: WeaponModuleState | null
}

export const DRONE_FIELDS = {
  droneId: 'string',
  armed: 'bool',
  playerControlled: 'bool',
  bodyX: 'int',
  bodyY: 'int',
  bodyRoomId: 'int',
  bodyRoomSquare: 'int',
  health: 'int',
} as const

export const DRONE_EXTENDED_FIELDS = { deployed: 'bool', armed: 'bool' } as const

export type ExtendedDroneInfo = StructOf<typeof DRONE_EXTENDED_FIELDS> & {
  /** Null for the types in PODLESS_DRONE_TYPES. */
  pod: DronePodState | null
}

/** `extended` is present from FTL 1.5.4. */
export type DroneState = StructOf<typeof DRONE_FIELDS> & {
  extended: ExtendedDroneInfo | null
}

export const DRONE_POD_FIELDS = {
  mourningTicks: 'int',
  currentSpace: 'int',
  destinationSpace: 'int',
  currentPositionX: 'int',
  currentPositionY: 'int',
  previousPositionX: 'int',
  previousPositionY: 'int',
  goalPositionX: 'int',
  goalPositionY: 'int',
  unknownEpsilon: 'int',
  unknownZeta: 'int',
  nextTargetX: 'int',
  nextTargetY: 'int',
  unknownIota: 'int',
  unknownKappa: 'int',
  buildupTicks: 'int',
  stationaryTicks: 'int',
  cooldownTicks: 'int',
  orbitAngle: 'int',
  turretAngle: 'int',
  unknownXi: 'int',
  hopsToLive: 'int',
  unknownPi: 'int',
  unknownRho: 'int',
  overloadTicks: 'int',
  unknownTau: 'int',
  unknownUpsilon: 'int',
  deltaPositionX: 'int',
  deltaPositionY: 'int',
} as const

export const BOARDER_POD_FIELDS = {
  unknownAlpha: 'int',
  unknownBeta: 'int',
  unknownGamma: 'int',
  unknownDelta: 'int',
  bodyHealth: 'int',
  bodyX: 'int',
  bodyY: 'int',
  bodyRoomId: 'int',
  bodyRoomSquare: 'int',
} as const

export const HACKING_POD_FIELDS = {
  attachPositionX: 'int',
  attachPositionY: 'int',
  unknownGamma: 'int',
  unknownDelta: 'int',
} as const

export const ZIGZAG_POD_FIELDS = {
  lastWaypointX: 'int',
  lastWaypointY: 'int',
  transitTicks: 'int',
  exhaustAngle: 'int',
  unknownEpsilon: 'int',
} as const

export const SHIELD_POD_FIELDS = { unknownAlpha: 'int' } as const

export type DronePodExtra =
  | ({ extra: 'BOARDER' } & StructOf<typeof BOARDER_POD_FIELDS>)
  | ({
      extra: 'HACKING'
      landingAnim: AnimState
      extensionAnim: AnimState
    } & StructOf<typeof HACKING_POD_FIELDS>)
  | ({ extra: 'ZIGZAG' } & StructOf<typeof ZIGZAG_POD_FIELDS>)
  | ({ extra: 'SHIELD' } & StructOf<typeof SHIELD_POD_FIELDS>)
  | { extra: 'NONE' }

export type DronePodState = StructOf<typeof DRONE_POD_FIELDS> & {
  deathAnim: AnimState
  extended: DronePodExtra
}

export const STANDALONE_DRONE_TAIL_FIELDS = {
  unknownAlpha: 'int',
  unknownBeta: 'int',
  unknownGamma: 'int',
} as const

/** Flagship swarms. Always empty on the player's ship. */
export type StandaloneDroneState = StructOf<typeof STANDALONE_DRONE_TAIL_FIELDS> & {
  droneId: string
  dronePod: DronePodState
}

// Ships.

export const SHIP_ID_FIELDS = {
  blueprintId: 'string',
  name: 'string',
  graphicsBaseName: 'string',
} as const

export const SHIP_JUMP_FIELDS = {
  hostile: 'bool',
  jumpChargeTicks: 'int',
  jumping: 'bool',
  jumpAnimTicks: 'int',
} as const

export const SHIP_SUPPLY_FIELDS = {
  hullAmt: 'int',
  fuelAmt: 'int',
  dronePartsAmt: 'int',
  missilesAmt: 'int',
  scrapAmt: 'int',
} as const

export type ShipState = StructOf<typeof SHIP_ID_FIELDS> &
  StructOf<typeof SHIP_JUMP_FIELDS> &
  StructOf<typeof SHIP_SUPPLY_FIELDS> & {
    startingCrew: StartingCrewState[]
    crew: CrewState[]
    reservePowerCapacity: number
    /** In SYSTEM_TYPES order, with a record per artillery room. */
    systems: SystemState[]
    clonebay: ClonebayInfo | null
    battery: BatteryInfo | null
    /** Present from FTL 1.5.4, even on ships with no shields system. */
    shields: ShieldsInfo | null
    cloaking: CloakingInfo | null
    hacking: HackingInfo | null
    mind: MindInfo | null
    /** One module per installed artillery room. */
    artillery: WeaponModuleState[]
    rooms: RoomState[]
    breaches: BreachState[]
    /** In saved-game order. @see ShipLayout.doors */
    doors: DoorState[]
    cloakAnimTicks: number
    lockdownCrystals: LockdownCrystal[]
    weapons: WeaponState[]
    drones: DroneState[]
    augmentIds: string[]
    standaloneDrones: StandaloneDroneState[]
  }

// The sector.

export interface StoreItem {
  itemId: string
  available: boolean
  /** FTL 1.5.12+. */
  extraData: number
}

export interface StoreShelf {
  itemType: StoreItemType
  /**
   * Always three slots, null where the shelf is empty.
   *
   * Java packs these into a list, which would move an item forward on writing
   * if an earlier slot were empty.
   */
  slots: Array<StoreItem | null>
}

export const STORE_SUPPLY_FIELDS = {
  fuel: 'int',
  missiles: 'int',
  droneParts: 'int',
} as const

export type StoreState = StructOf<typeof STORE_SUPPLY_FIELDS> & { shelves: StoreShelf[] }

export const BEACON_BACKGROUND_FIELDS = {
  bgStarscapeImageInnerPath: 'string',
  bgSpriteImageInnerPath: 'string',
  bgSpritePosX: 'int',
  bgSpritePosY: 'int',
  bgSpriteRotation: 'int',
} as const

export const BEACON_ENEMY_FIELDS = {
  shipEventId: 'string',
  autoBlueprintId: 'string',
  shipEventSeed: 'int',
} as const

export type BeaconState = StructOf<typeof BEACON_BACKGROUND_FIELDS> &
  StructOf<typeof BEACON_ENEMY_FIELDS> & {
    visitCount: number
    seen: boolean
    enemyPresent: boolean
    fleetPresence: FleetPresence
    underAttack: boolean
    store: StoreState | null
  }

export const ENCOUNTER_EVENT_FIELDS = {
  shipEventSeed: 'int',
  surrenderEventId: 'string',
  escapeEventId: 'string',
  destroyedEventId: 'string',
  deadCrewEventId: 'string',
  gotAwayEventId: 'string',
  lastEventId: 'string',
} as const

export type EncounterState = StructOf<typeof ENCOUNTER_EVENT_FIELDS> & {
  /** FTL 1.6.1+. */
  unknownAlpha: number
  text: string
  affectedCrewSeed: number
  choices: number[]
}

export const NEARBY_SHIP_AI_FIELDS = {
  surrendered: 'bool',
  escaping: 'bool',
  destroyed: 'bool',
  surrenderThreshold: 'int',
  escapeThreshold: 'int',
  escapeTicks: 'int',
  stalemateTriggered: 'bool',
  stalemateTicks: 'int',
  boardingAttempts: 'int',
  boardersNeeded: 'int',
} as const
export type NearbyShipAIState = StructOf<typeof NEARBY_SHIP_AI_FIELDS>

export const ENVIRONMENT_HAZARD_FIELDS = {
  redGiantPresent: 'bool',
  pulsarPresent: 'bool',
  pdsPresent: 'bool',
} as const

export const ASTEROID_FIELD_FIELDS = {
  unknownAlpha: 'int',
  strayRockTicks: 'int',
  unknownGamma: 'int',
  bgDriftTicks: 'int',
  currentTarget: 'int',
} as const
export type AsteroidFieldState = StructOf<typeof ASTEROID_FIELD_FIELDS>

export const ENVIRONMENT_TICK_FIELDS = {
  solarFlareFadeTicks: 'int',
  havocTicks: 'int',
  pdsTicks: 'int',
} as const

export type EnvironmentState = StructOf<typeof ENVIRONMENT_HAZARD_FIELDS> &
  StructOf<typeof ENVIRONMENT_TICK_FIELDS> & {
    vulnerableShips: HazardVulnerability
    asteroidField: AsteroidFieldState | null
  }

export interface RebelFlagshipState {
  /** FTL 1.5.4+. */
  unknownAlpha: number
  pendingStage: number
  /** FTL 1.5.4+. */
  unknownGamma: number
  /** FTL 1.5.4+. */
  unknownDelta: number
  /** Previous crew count, by room id. */
  occupancy: number[]
}

// The file as a whole.

export const SESSION_FIELDS = {
  totalShipsDefeated: 'int',
  totalBeaconsExplored: 'int',
  totalScrapCollected: 'int',
  totalCrewHired: 'int',
  playerShipName: 'string',
  playerShipBlueprintId: 'string',
} as const

export const PURSUIT_FIELDS = {
  sectorTreeSeed: 'int',
  sectorLayoutSeed: 'int',
  rebelFleetOffset: 'int',
  rebelFleetFudge: 'int',
  rebelPursuitMod: 'int',
} as const

export const AE_TRANSIT_FIELDS = {
  currentBeaconId: 'int',
  waiting: 'bool',
  waitEventSeed: 'int',
  unknownEpsilon: 'string',
  sectorHazardsVisible: 'bool',
  rebelFlagshipVisible: 'bool',
  rebelFlagshipHop: 'int',
  rebelFlagshipMoving: 'bool',
  rebelFlagshipRetreating: 'bool',
  rebelFlagshipBaseTurns: 'int',
} as const

export interface StateVar {
  id: string
  value: number
}

export interface QuestEvent {
  eventId: string
  beaconId: number
}

export type SavedGame = StructOf<typeof SESSION_FIELDS> &
  StructOf<typeof PURSUIT_FIELDS> &
  StructOf<typeof AE_TRANSIT_FIELDS> & {
    fileFormat: number
    /** Whether the OS's RNG was in use. Stored from FTL 1.6.1. */
    randomNative: boolean
    dlcEnabled: boolean
    difficulty: Difficulty
    unknownBeta: number
    stateVars: StateVar[]
    playerShip: ShipState
    cargoIds: string[]
    /** One flag per column of the sector tree. */
    sectorVisitation: boolean[]
    /** 0-based. */
    sectorNumber: number
    sectorIsHiddenCrystalWorlds: boolean
    beacons: BeaconState[]
    questEvents: QuestEvent[]
    distantQuestEventIds: string[]
    unknownMu: number
    encounter: EncounterState | null
    rebelFlagshipNearby: boolean
    nearbyShip: ShipState | null
    nearbyShipAI: NearbyShipAIState | null
    environment: EnvironmentState | null
    projectiles: ProjectileState[]
    unknownNu: number
    /** Only present with a nearby ship. */
    unknownXi: number | null
    autofire: boolean
    rebelFlagship: RebelFlagshipState
  }
