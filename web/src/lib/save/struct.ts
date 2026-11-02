import type { BinaryReader } from '../io/BinaryReader'
import type { BinaryWriter } from '../io/BinaryWriter'

/**
 * Field tables for the flat runs of values that make up most of a saved game.
 *
 * The Java parser spells every record out twice, once to read and once to
 * write, and the file only survives if the two agree. Here each run is declared
 * once: key order is byte order, and the TypeScript type comes from the same
 * table, so a read, its write and its type cannot drift apart.
 */

export type FieldKind = 'int' | 'bool' | 'string'
export type Fields = Readonly<Record<string, FieldKind>>

type ValueOf<K extends FieldKind> = K extends 'int'
  ? number
  : K extends 'bool'
    ? boolean
    : string

export type StructOf<F extends Fields> = { -readonly [K in keyof F]: ValueOf<F[K]> }

export function readStruct<F extends Fields>(
  reader: BinaryReader,
  fields: F,
): StructOf<F> {
  const out: Record<string, number | boolean | string> = {}

  for (const [key, kind] of Object.entries(fields)) {
    if (kind === 'int') out[key] = reader.readInt()
    else if (kind === 'bool') out[key] = reader.readBool()
    else out[key] = reader.readString()
  }

  return out as StructOf<F>
}

/** Writes the listed fields of `value`. Other properties are ignored. */
export function writeStruct<F extends Fields>(
  writer: BinaryWriter,
  fields: F,
  value: StructOf<F>,
): void {
  const source = value as Record<string, number | boolean | string>

  for (const [key, kind] of Object.entries(fields)) {
    if (kind === 'int') writer.writeInt(source[key] as number)
    else if (kind === 'bool') writer.writeBool(source[key] as boolean)
    else writer.writeString(source[key] as string)
  }
}

/** The zero value of a table, for fields a file format doesn't have. */
export function blankStruct<F extends Fields>(fields: F): StructOf<F> {
  const out: Record<string, number | boolean | string> = {}

  for (const [key, kind] of Object.entries(fields)) {
    out[key] = kind === 'int' ? 0 : kind === 'bool' ? false : ''
  }

  return out as StructOf<F>
}
