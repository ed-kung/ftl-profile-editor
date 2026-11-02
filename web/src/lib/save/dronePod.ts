import { ParseError, type BinaryReader } from '../io/BinaryReader'
import type { BinaryWriter } from '../io/BinaryWriter'
import { readAnim, writeAnim } from './projectile'
import { readStruct, writeStruct } from './struct'
import {
  BOARDER_POD_FIELDS,
  DRONE_POD_FIELDS,
  HACKING_POD_FIELDS,
  SHIELD_POD_FIELDS,
  ZIGZAG_POD_FIELDS,
  type DronePodExtra,
  type DronePodState,
  type DroneType,
} from './types'

/** The pod's shape isn't marked in the file: it follows from the drone's type. */
export function readDronePod(reader: BinaryReader, droneType: DroneType): DronePodState {
  const at = reader.offset
  const fields = readStruct(reader, DRONE_POD_FIELDS)
  const deathAnim = readAnim(reader)

  return { ...fields, deathAnim, extended: readExtra(reader, droneType, at) }
}

function readExtra(
  reader: BinaryReader,
  droneType: DroneType,
  podOffset: number,
): DronePodExtra {
  switch (droneType) {
    case 'BOARDER':
      return { extra: 'BOARDER', ...readStruct(reader, BOARDER_POD_FIELDS) }
    case 'HACKING': {
      const fields = readStruct(reader, HACKING_POD_FIELDS)
      const landingAnim = readAnim(reader)
      const extensionAnim = readAnim(reader)
      return { extra: 'HACKING', ...fields, landingAnim, extensionAnim }
    }
    case 'COMBAT':
    case 'BEAM':
    case 'SHIP_REPAIR':
      return { extra: 'ZIGZAG', ...readStruct(reader, ZIGZAG_POD_FIELDS) }
    case 'DEFENSE':
      return { extra: 'NONE' }
    case 'SHIELD':
      return { extra: 'SHIELD', ...readStruct(reader, SHIELD_POD_FIELDS) }
    case 'BATTLE':
    case 'REPAIR':
      throw new ParseError(`A ${droneType} drone has no drone pod`, podOffset)
  }
}

export function writeDronePod(writer: BinaryWriter, pod: DronePodState): void {
  writeStruct(writer, DRONE_POD_FIELDS, pod)
  writeAnim(writer, pod.deathAnim)

  const extended = pod.extended
  switch (extended.extra) {
    case 'BOARDER':
      writeStruct(writer, BOARDER_POD_FIELDS, extended)
      break
    case 'HACKING':
      writeStruct(writer, HACKING_POD_FIELDS, extended)
      writeAnim(writer, extended.landingAnim)
      writeAnim(writer, extended.extensionAnim)
      break
    case 'ZIGZAG':
      writeStruct(writer, ZIGZAG_POD_FIELDS, extended)
      break
    case 'SHIELD':
      writeStruct(writer, SHIELD_POD_FIELDS, extended)
      break
    case 'NONE':
      break
  }
}
