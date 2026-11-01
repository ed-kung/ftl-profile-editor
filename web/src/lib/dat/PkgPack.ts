/**
 * A reader for FTL 1.6.1+ "ftl.dat" archives (PKG format).
 *
 * Structure:
 *   header       - the "PKG\n" signature and four numbers (16 bytes)
 *   entry table  - one 20-byte hunk per nested file
 *   paths region - null-terminated innerPath strings
 *   data         - each entry's bytes, at its own offset
 *
 * All header and index fields are big-endian, unlike the save files themselves.
 *
 * Only the read half of net.vhati.ftldat.PkgPack is ported; nothing here
 * repacks a dat. The index lives in the first ~180KB of the file, so a Blob
 * slice reads it without pulling the whole 278MB archive into memory, and each
 * entry's bytes are sliced on demand.
 *
 * See SIL: System Interface Library for games -- http://achurch.org/SIL/
 */

/** Bitmask flag for "deflate" compression, stored in the path-offset field. */
const PKGF_DEFLATED = 1 << 24

const HEADER_SIZE = 16
const ENTRY_SIZE = 20
const SIGNATURE = [0x50, 0x4b, 0x47, 0x0a] // "PKG\n"

export interface PackEntry {
  innerPath: string
  dataOffset: number
  dataSize: number
  unpackedSize: number
  deflated: boolean
}

/** A Blob-like source: a File from an <input>, or a Blob in tests. */
export interface ByteSource {
  readonly size: number
  slice(start: number, end: number): Blob
}

export class PkgPack {
  private constructor(
    private readonly source: ByteSource,
    private readonly entries: Map<string, PackEntry>,
  ) {}

  /** Reads the index. Resolves once the archive is ready to serve entries. */
  static async open(source: ByteSource): Promise<PkgPack> {
    if (source.size < HEADER_SIZE) {
      throw new DatFormatError('File is too small to be an FTL dat')
    }

    const header = new DataView(
      await source.slice(0, HEADER_SIZE).arrayBuffer(),
    )

    for (let i = 0; i < SIGNATURE.length; i++) {
      if (header.getUint8(i) !== SIGNATURE[i]) {
        throw new DatFormatError(
          'Unexpected file signature: this is not an FTL 1.6.1+ "ftl.dat"',
        )
      }
    }

    const headerSize = header.getUint16(4)
    if (headerSize !== HEADER_SIZE) {
      throw new DatFormatError(
        `Corrupt dat: header claims header size is ${headerSize} bytes (expected ${HEADER_SIZE})`,
      )
    }

    const entrySize = header.getUint16(6)
    if (entrySize !== ENTRY_SIZE) {
      throw new DatFormatError(
        `Corrupt dat: header claims entries are ${entrySize} bytes (expected ${ENTRY_SIZE})`,
      )
    }

    const entryCount = header.getUint32(8)
    if (entryCount * entrySize > source.size) {
      throw new DatFormatError(
        'Corrupt dat: header claims entries combined are larger than the entire file',
      )
    }

    const pathsRegionSize = header.getUint32(12)
    if (pathsRegionSize > source.size) {
      throw new DatFormatError(
        'Corrupt dat: header claims path strings are larger than the entire file',
      )
    }

    const tableStart = HEADER_SIZE
    const tableEnd = tableStart + entryCount * entrySize
    const pathsEnd = tableEnd + pathsRegionSize

    const [table, paths] = await Promise.all([
      source
        .slice(tableStart, tableEnd)
        .arrayBuffer()
        .then((b) => new DataView(b)),
      source
        .slice(tableEnd, pathsEnd)
        .arrayBuffer()
        .then((b) => new Uint8Array(b)),
    ])

    const entries = new Map<string, PackEntry>()

    for (let i = 0; i < entryCount; i++) {
      const o = i * entrySize

      // The top 8 bits of the path-offset field were set aside for flags.
      const pathOffsetAndFlags = table.getUint32(o + 4)
      const dataOffset = table.getUint32(o + 8)

      // A null entry: the dat was grown but never repacked.
      if (dataOffset === 0) continue

      const pathOffset = pathOffsetAndFlags & 0x00ffffff
      let pathEnd = paths.indexOf(0, pathOffset)
      if (pathEnd === -1) pathEnd = paths.length

      const innerPath = ASCII_DECODER.decode(paths.subarray(pathOffset, pathEnd))

      entries.set(innerPath, {
        innerPath,
        dataOffset,
        dataSize: table.getUint32(o + 12),
        unpackedSize: table.getUint32(o + 16),
        deflated: (pathOffsetAndFlags & PKGF_DEFLATED) !== 0,
      })
    }

    return new PkgPack(source, entries)
  }

  get size(): number {
    return this.entries.size
  }

  listPaths(): string[] {
    return [...this.entries.keys()]
  }

  has(innerPath: string): boolean {
    return this.entries.has(innerPath)
  }

  getEntry(innerPath: string): PackEntry | undefined {
    return this.entries.get(innerPath)
  }

  /** Reads one nested file, inflating it if the archive stored it deflated. */
  async getBytes(innerPath: string): Promise<Uint8Array> {
    const entry = this.entries.get(innerPath)
    if (!entry) {
      throw new Error(`Not found in dat: ${innerPath}`)
    }

    const blob = this.source.slice(
      entry.dataOffset,
      entry.dataOffset + entry.dataSize,
    )

    if (!entry.deflated) {
      return new Uint8Array(await blob.arrayBuffer())
    }

    // Java wrote these with InflaterInputStream's default, which is zlib-wrapped.
    const stream = blob.stream().pipeThrough(new DecompressionStream('deflate'))
    const inflated = new Uint8Array(await new Response(stream).arrayBuffer())

    if (inflated.length !== entry.unpackedSize) {
      throw new DatFormatError(
        `Corrupt dat: "${innerPath}" inflated to ${inflated.length} bytes ` +
          `(index claims ${entry.unpackedSize})`,
      )
    }
    return inflated
  }

  async getText(innerPath: string): Promise<string> {
    return UTF8_DECODER.decode(await this.getBytes(innerPath))
  }
}

const ASCII_DECODER = new TextDecoder('ascii')
const UTF8_DECODER = new TextDecoder('utf-8')

export class DatFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatFormatError'
  }
}
