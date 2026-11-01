// @vitest-environment node
//
// The archive readers touch no DOM, and jsdom's Blob lacks arrayBuffer().
import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

import { DatFormatError, PkgPack } from '../src/lib/dat/PkgPack'
import { toBlobPart } from '../src/lib/io/blob'
import { FTLPack } from '../src/lib/dat/FTLPack'

const ASCII = new TextEncoder()

interface SyntheticEntry {
  innerPath: string
  contents: string
  deflate?: boolean
  /** Emit this entry as a null index slot, as an un-repacked dat has. */
  nullSlot?: boolean
}

/** Builds a PKG archive in memory, matching what FTL 1.6.1+ ships. */
function buildPkg(entries: SyntheticEntry[]): Blob {
  const paths: number[] = []
  const pathOffsets = entries.map((e) => {
    const offset = paths.length
    paths.push(...ASCII.encode(e.innerPath), 0)
    return offset
  })

  const payloads = entries.map((e) => {
    const raw = ASCII.encode(e.contents)
    return e.deflate ? new Uint8Array(deflateSync(raw)) : raw
  })

  const headerSize = 16
  const tableSize = entries.length * 20
  const dataStart = headerSize + tableSize + paths.length

  const total =
    dataStart + payloads.reduce((sum, p) => sum + p.length, 0)
  const buf = new Uint8Array(total)
  const view = new DataView(buf.buffer)

  buf.set(ASCII.encode('PKG\n'), 0)
  view.setUint16(4, headerSize)
  view.setUint16(6, 20)
  view.setUint32(8, entries.length)
  view.setUint32(12, paths.length)

  let dataOffset = dataStart
  entries.forEach((e, i) => {
    const o = headerSize + i * 20
    const flags = e.deflate ? 1 << 24 : 0

    view.setUint32(o, 0) // innerPathHash, unused by the reader
    view.setUint32(o + 4, pathOffsets[i] | flags)
    view.setUint32(o + 8, e.nullSlot ? 0 : dataOffset)
    view.setUint32(o + 12, payloads[i].length)
    view.setUint32(o + 16, ASCII.encode(e.contents).length)

    buf.set(payloads[i], dataOffset)
    dataOffset += payloads[i].length
  })

  buf.set(new Uint8Array(paths), headerSize + tableSize)

  return new Blob([toBlobPart(buf)])
}

/** Builds a data.dat/resource.dat archive, as FTL 1.01-1.5.13 shipped. */
function buildFtlDat(entries: Array<{ innerPath: string; contents: string }>): Blob {
  const chunks: Uint8Array[] = []
  const offsets: number[] = []

  let offset = 4 + entries.length * 4
  for (const e of entries) {
    const path = ASCII.encode(e.innerPath)
    const data = ASCII.encode(e.contents)

    const chunk = new Uint8Array(8 + path.length + data.length)
    const view = new DataView(chunk.buffer)
    view.setUint32(0, data.length, true)
    view.setUint32(4, path.length, true)
    chunk.set(path, 8)
    chunk.set(data, 8 + path.length)

    offsets.push(offset)
    offset += chunk.length
    chunks.push(chunk)
  }

  const header = new Uint8Array(4 + entries.length * 4)
  const headerView = new DataView(header.buffer)
  headerView.setUint32(0, entries.length, true)
  offsets.forEach((o, i) => headerView.setUint32(4 + i * 4, o, true))

  return new Blob([header, ...chunks].map(toBlobPart))
}

describe('PkgPack', () => {
  it('indexes entries and reads their bytes', async () => {
    const pack = await PkgPack.open(
      buildPkg([
        { innerPath: 'data/blueprints.xml', contents: '<FTL>stock</FTL>' },
        { innerPath: 'img/ship/kestral_base.png', contents: 'not really a png' },
      ]),
    )

    expect(pack.size).toBe(2)
    expect(pack.listPaths()).toEqual([
      'data/blueprints.xml',
      'img/ship/kestral_base.png',
    ])
    expect(await pack.getText('data/blueprints.xml')).toBe('<FTL>stock</FTL>')
    expect(await pack.getText('img/ship/kestral_base.png')).toBe('not really a png')
  })

  it('inflates entries stored with the deflate flag', async () => {
    // Nothing in vanilla 1.6.3 is deflated, but modded dats can be.
    const contents = '<FTL>'.repeat(400)
    const pack = await PkgPack.open(
      buildPkg([{ innerPath: 'data/events.xml', contents, deflate: true }]),
    )

    expect(pack.getEntry('data/events.xml')?.deflated).toBe(true)
    expect(await pack.getText('data/events.xml')).toBe(contents)
  })

  it('skips null index slots left by an un-repacked dat', async () => {
    const pack = await PkgPack.open(
      buildPkg([
        { innerPath: 'data/gone.xml', contents: 'removed', nullSlot: true },
        { innerPath: 'data/here.xml', contents: 'present' },
      ]),
    )

    expect(pack.has('data/gone.xml')).toBe(false)
    expect(pack.has('data/here.xml')).toBe(true)
  })

  it('rejects a file that is not a PKG archive', async () => {
    const notADat = new Blob([
      toBlobPart(ASCII.encode('This is a saved game, not ftl.dat')),
    ])
    await expect(PkgPack.open(notADat)).rejects.toThrow(DatFormatError)
    await expect(PkgPack.open(notADat)).rejects.toThrow(/not an FTL 1\.6\.1\+/)
  })

  it('rejects an index that claims to be bigger than the file', async () => {
    const buf = new Uint8Array(32)
    const view = new DataView(buf.buffer)
    buf.set(ASCII.encode('PKG\n'), 0)
    view.setUint16(4, 16)
    view.setUint16(6, 20)
    view.setUint32(8, 100000) // entryCount
    view.setUint32(12, 0)

    await expect(PkgPack.open(new Blob([toBlobPart(buf)]))).rejects.toThrow(
      /larger than the entire file/,
    )
  })

  it('reports a mismatch between inflated and indexed sizes', async () => {
    const pkg = buildPkg([
      { innerPath: 'data/x.xml', contents: 'abcdefgh', deflate: true },
    ])
    const buf = new Uint8Array(await pkg.arrayBuffer())
    // Corrupt the recorded unpacked size.
    new DataView(buf.buffer).setUint32(16 + 16, 999)

    const pack = await PkgPack.open(new Blob([toBlobPart(buf)]))
    await expect(pack.getBytes('data/x.xml')).rejects.toThrow(/inflated to 8 bytes/)
  })
})

describe('FTLPack', () => {
  it('indexes entries and reads their bytes', async () => {
    const pack = await FTLPack.open(
      buildFtlDat([
        { innerPath: 'data/blueprints.xml', contents: '<FTL>old</FTL>' },
        { innerPath: 'data/achievements.xml', contents: '<FTL>achs</FTL>' },
      ]),
    )

    expect(pack.size).toBe(2)
    expect(await pack.getText('data/blueprints.xml')).toBe('<FTL>old</FTL>')
    expect(await pack.getText('data/achievements.xml')).toBe('<FTL>achs</FTL>')
  })

  it('rejects an index that claims to be bigger than the file', async () => {
    const buf = new Uint8Array(8)
    new DataView(buf.buffer).setUint32(0, 100000, true)
    await expect(FTLPack.open(new Blob([toBlobPart(buf)]))).rejects.toThrow(
      /larger than the entire file/,
    )
  })
})
