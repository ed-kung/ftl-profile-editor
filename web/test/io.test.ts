import { describe, expect, it } from 'vitest'

import { BinaryReader, ParseError } from '../src/lib/io/BinaryReader'
import { BinaryWriter } from '../src/lib/io/BinaryWriter'
import {
  UnencodableCharacterError,
  decodeCp1252,
  encodeCp1252,
} from '../src/lib/io/cp1252'

describe('cp1252', () => {
  it('round-trips the characters an old profile can hold', () => {
    const samples = [
      'Kestrel',
      'Ihlay Caris',
      'café', // latin-1 range
      '“quoted”', // the 0x80-0x9F range where cp1252 differs
      '€100',
      'naïve – dash',
    ]

    for (const sample of samples) {
      expect(decodeCp1252(encodeCp1252(sample))).toBe(sample)
    }
  })

  it('maps the 0x80-0x9F range the way windows-1252 does, not latin-1', () => {
    expect([...encodeCp1252('€')]).toEqual([0x80])
    expect([...encodeCp1252('’')]).toEqual([0x92])
    expect([...encodeCp1252('Ÿ')]).toEqual([0x9f])
  })

  it('refuses characters the codepage cannot hold', () => {
    // Substituting "?" would silently mangle a crew name instead.
    expect(() => encodeCp1252('Nebula 月')).toThrow(UnencodableCharacterError)
    expect(() => encodeCp1252('rocket \u{1F680}')).toThrow(/cannot be written/)
  })
})

describe('BinaryReader / BinaryWriter', () => {
  it('round-trips little-endian ints, including negatives', () => {
    const writer = new BinaryWriter()
    const values = [0, 1, -1, 2147483647, -2147483648, 4801]
    for (const v of values) writer.writeInt(v)

    const reader = new BinaryReader(writer.toBytes())
    expect(values.map(() => reader.readInt())).toEqual(values)
    expect(reader.atEnd).toBe(true)
  })

  it('writes bools as ints and rejects anything else on read', () => {
    const writer = new BinaryWriter()
    writer.writeBool(true)
    writer.writeBool(false)
    writer.writeInt(2)

    const reader = new BinaryReader(writer.toBytes())
    expect(reader.readBool()).toBe(true)
    expect(reader.readBool()).toBe(false)
    expect(() => reader.readBool()).toThrow(/Not a bool: 2/)
  })

  it('round-trips strings in both encodings', () => {
    for (const unicode of [false, true]) {
      const writer = new BinaryWriter()
      writer.setUnicode(unicode)
      writer.writeString('Bulwark')
      writer.writeString('')

      const reader = new BinaryReader(writer.toBytes())
      reader.setUnicode(unicode)
      expect(reader.readString()).toBe('Bulwark')
      expect(reader.readString()).toBe('')
    }
  })

  it('counts bytes, not characters, in a unicode string length', () => {
    const writer = new BinaryWriter()
    writer.setUnicode(true)
    writer.writeString('café') // 4 chars, 5 UTF-8 bytes

    const bytes = writer.toBytes()
    expect(new DataView(bytes.buffer).getInt32(0, true)).toBe(5)

    const reader = new BinaryReader(bytes)
    reader.setUnicode(true)
    expect(reader.readString()).toBe('café')
  })

  it('reports the offset where a read ran off the end', () => {
    const reader = new BinaryReader(new Uint8Array([1, 2, 3]))
    try {
      reader.readInt()
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError)
      expect((e as ParseError).offset).toBe(0)
    }
  })

  it('refuses a negative string length rather than allocating', () => {
    const bytes = new Uint8Array(new Int32Array([-1]).buffer)
    expect(() => new BinaryReader(bytes).readString()).toThrow(
      /Negative string length/,
    )
  })
})
