import { DatFormatError, type ByteSource, type PackEntry } from './PkgPack'

/**
 * A reader for FTL 1.01-1.5.13 "data.dat" / "resource.dat" archives.
 *
 * Structure:
 *   indexSize    - little-endian uint
 *   offset table - indexSize little-endian uints, one per entry (0 = absent)
 *   per entry, at its own offset:
 *     dataSize   - little-endian uint
 *     innerPath  - little-endian uint bytecount + ASCII bytes
 *     data       - dataSize bytes
 *
 * Little-endian throughout, unlike the PKG format that replaced it. Nothing is
 * compressed. Only the read half of net.vhati.ftldat.FTLPack is ported.
 *
 * Each entry's header sits immediately before its own data rather than in one
 * contiguous table, so building the index means one small read per entry. That
 * is slower than PkgPack's three reads, but these archives only turn up on
 * pre-1.6.1 installs.
 */
export class FTLPack {
  private constructor(
    private readonly source: ByteSource,
    private readonly entries: Map<string, PackEntry>,
  ) {}

  static async open(source: ByteSource): Promise<FTLPack> {
    if (source.size < 4) {
      throw new DatFormatError('File is too small to be an FTL dat')
    }

    const head = new DataView(await source.slice(0, 4).arrayBuffer())
    const indexSize = head.getUint32(0, true)

    if (indexSize === 0 || 4 + indexSize * 4 > source.size) {
      throw new DatFormatError(
        'Corrupt dat: header claims to be larger than the entire file',
      )
    }

    const table = new DataView(
      await source.slice(4, 4 + indexSize * 4).arrayBuffer(),
    )

    const offsets: number[] = []
    for (let i = 0; i < indexSize; i++) {
      const entryOffset = table.getUint32(i * 4, true)
      // A zero offset means that index slot is unused.
      if (entryOffset !== 0) offsets.push(entryOffset)
    }

    const entries = new Map<string, PackEntry>()

    // Enough to cover dataSize + bytecount + any sane innerPath.
    const HEADER_PROBE = 512
    const BATCH = 64

    for (let i = 0; i < offsets.length; i += BATCH) {
      const batch = offsets.slice(i, i + BATCH)
      const probes = await Promise.all(
        batch.map((entryOffset) =>
          source
            .slice(
              entryOffset,
              Math.min(entryOffset + HEADER_PROBE, source.size),
            )
            .arrayBuffer(),
        ),
      )

      for (let j = 0; j < batch.length; j++) {
        const entryOffset = batch[j]
        const probe = new Uint8Array(probes[j])
        if (probe.length < 8) {
          throw new DatFormatError(
            `Corrupt dat: entry header at ${entryOffset} runs past the end of the file`,
          )
        }

        const probeView = new DataView(probe.buffer)
        const dataSize = probeView.getUint32(0, true)
        const pathLength = probeView.getUint32(4, true)

        if (8 + pathLength > probe.length) {
          throw new DatFormatError(
            `Corrupt dat: entry at ${entryOffset} claims a ${pathLength}-byte inner path`,
          )
        }

        const innerPath = ASCII_DECODER.decode(
          probe.subarray(8, 8 + pathLength),
        )

        if (entries.has(innerPath)) {
          throw new DatFormatError(`InnerPath occurs more than once: ${innerPath}`)
        }

        entries.set(innerPath, {
          innerPath,
          dataOffset: entryOffset + 8 + pathLength,
          dataSize,
          unpackedSize: dataSize,
          deflated: false,
        })
      }
    }

    return new FTLPack(source, entries)
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

  async getBytes(innerPath: string): Promise<Uint8Array> {
    const entry = this.entries.get(innerPath)
    if (!entry) {
      throw new Error(`Not found in dat: ${innerPath}`)
    }

    const blob = this.source.slice(
      entry.dataOffset,
      entry.dataOffset + entry.dataSize,
    )
    return new Uint8Array(await blob.arrayBuffer())
  }

  async getText(innerPath: string): Promise<string> {
    return UTF8_DECODER.decode(await this.getBytes(innerPath))
  }
}

const ASCII_DECODER = new TextDecoder('ascii')
const UTF8_DECODER = new TextDecoder('utf-8')
