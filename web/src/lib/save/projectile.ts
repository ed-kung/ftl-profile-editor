import { ParseError, type BinaryReader } from '../io/BinaryReader'
import type { BinaryWriter } from '../io/BinaryWriter'
import { readStruct, writeStruct } from './struct'
import {
  ANIM_FIELDS,
  BEAM_PROJECTILE_FIELDS,
  BOMB_PROJECTILE_FIELDS,
  DAMAGE_FIELDS,
  LASER_PROJECTILE_FIELDS,
  PDS_PROJECTILE_FIELDS,
  PROJECTILE_FLIGHT_FIELDS,
  PROJECTILE_KINDS,
  PROJECTILE_OUTCOME_FIELDS,
  PROJECTILE_POSITION_FIELDS,
  type AnimState,
  type LiveProjectile,
  type ProjectileExtra,
  type ProjectileState,
} from './types'

export function readAnim(reader: BinaryReader): AnimState {
  return readStruct(reader, ANIM_FIELDS)
}

export function writeAnim(writer: BinaryWriter, anim: AnimState): void {
  writeStruct(writer, ANIM_FIELDS, anim)
}

/** The PDS flag only exists from FTL 1.6.1. */
function isSupportedFlag(flag: number, fileFormat: number): boolean {
  if (flag < 0 || flag >= PROJECTILE_KINDS.length) return false
  return PROJECTILE_KINDS[flag] !== 'PDS' || fileFormat === 11
}

export function readProjectile(reader: BinaryReader, fileFormat: number): ProjectileState {
  const at = reader.offset
  const flag = reader.readInt()
  if (!isSupportedFlag(flag, fileFormat)) {
    throw new ParseError(`Unsupported projectile type flag: ${flag}`, at)
  }

  const kind = PROJECTILE_KINDS[flag]
  if (kind === 'INVALID') return { kind }

  const position = readStruct(reader, PROJECTILE_POSITION_FIELDS)
  const damage = readStruct(reader, DAMAGE_FIELDS)
  const flight = readStruct(reader, PROJECTILE_FLIGHT_FIELDS)
  const deathAnim = readAnim(reader)
  const flightAnim = readAnim(reader)
  const outcome = readStruct(reader, PROJECTILE_OUTCOME_FIELDS)

  return {
    ...position,
    ...flight,
    ...outcome,
    kind,
    damage,
    deathAnim,
    flightAnim,
    extended: readExtra(reader, kind),
  }
}

function readExtra(reader: BinaryReader, kind: LiveProjectile['kind']): ProjectileExtra {
  switch (kind) {
    case 'LASER_OR_BURST':
      return { extra: 'LASER', ...readStruct(reader, LASER_PROJECTILE_FIELDS) }
    case 'BOMB':
      return { extra: 'BOMB', ...readStruct(reader, BOMB_PROJECTILE_FIELDS) }
    case 'BEAM':
      return { extra: 'BEAM', ...readStruct(reader, BEAM_PROJECTILE_FIELDS) }
    case 'PDS': {
      const fields = readStruct(reader, PDS_PROJECTILE_FIELDS)
      return { extra: 'PDS', ...fields, unknownZeta: readAnim(reader) }
    }
    case 'ROCK_OR_EXPLOSION':
    case 'MISSILE':
      return { extra: 'NONE' }
  }
}

export function writeProjectile(
  writer: BinaryWriter,
  projectile: ProjectileState,
  fileFormat: number,
): void {
  const flag = PROJECTILE_KINDS.indexOf(projectile.kind)
  if (!isSupportedFlag(flag, fileFormat)) {
    throw new Error(`Unsupported projectile type: ${projectile.kind}`)
  }
  writer.writeInt(flag)

  if (projectile.kind === 'INVALID') return

  writeStruct(writer, PROJECTILE_POSITION_FIELDS, projectile)
  writeStruct(writer, DAMAGE_FIELDS, projectile.damage)
  writeStruct(writer, PROJECTILE_FLIGHT_FIELDS, projectile)
  writeAnim(writer, projectile.deathAnim)
  writeAnim(writer, projectile.flightAnim)
  writeStruct(writer, PROJECTILE_OUTCOME_FIELDS, projectile)

  const extended = projectile.extended
  switch (extended.extra) {
    case 'LASER':
      writeStruct(writer, LASER_PROJECTILE_FIELDS, extended)
      break
    case 'BOMB':
      writeStruct(writer, BOMB_PROJECTILE_FIELDS, extended)
      break
    case 'BEAM':
      writeStruct(writer, BEAM_PROJECTILE_FIELDS, extended)
      break
    case 'PDS':
      writeStruct(writer, PDS_PROJECTILE_FIELDS, extended)
      writeAnim(writer, extended.unknownZeta)
      break
    case 'NONE':
      break
  }
}
