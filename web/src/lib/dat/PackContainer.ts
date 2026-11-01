import { DatFormatError, type ByteSource } from './PkgPack'
import { PkgPack } from './PkgPack'
import { FTLPack } from './FTLPack'

/** Whatever an archive reader has to offer, regardless of its format. */
export interface Pack {
  readonly size: number
  listPaths(): string[]
  has(innerPath: string): boolean
  getBytes(innerPath: string): Promise<Uint8Array>
  getText(innerPath: string): Promise<string>
}

/**
 * Resolves inner paths across the archives an FTL install is split into.
 *
 * FTL 1.6.1+ keeps everything in one "ftl.dat". Earlier versions split it:
 * "data.dat" holds data/, "resource.dat" holds audio/, fonts/ and img/.
 *
 * @see net.blerf.ftl.parser.DefaultDataManager's constructor
 */
export class PackContainer implements Pack {
  private readonly prefixPacks: Array<[string, Pack]> = []

  private constructor(
    readonly label: string,
    private readonly fallback: Pack,
  ) {}

  /**
   * Opens a single "ftl.dat" (FTL 1.6.1+).
   *
   * The caller should hand over the File straight from an <input>; only the
   * index is read here.
   */
  static async openFtlDat(source: ByteSource): Promise<PackContainer> {
    const pack = await PkgPack.open(source)
    return new PackContainer('ftl.dat', pack)
  }

  /** Opens a "data.dat" + "resource.dat" pair (FTL 1.01-1.5.13). */
  static async openSplitDats(
    dataSource: ByteSource,
    resourceSource: ByteSource,
  ): Promise<PackContainer> {
    const [dataPack, resourcePack] = await Promise.all([
      FTLPack.open(dataSource),
      FTLPack.open(resourceSource),
    ])

    const container = new PackContainer('data.dat + resource.dat', dataPack)
    container.prefixPacks.push(
      ['data/', dataPack],
      ['audio/', resourcePack],
      ['fonts/', resourcePack],
      ['img/', resourcePack],
    )
    return container
  }

  /**
   * Opens whichever format the given file turns out to be.
   *
   * A "data.dat" needs its "resource.dat" sibling to be useful, which the
   * browser cannot go and fetch on its own -- so that case is reported rather
   * than guessed at.
   */
  static async open(source: ByteSource, fileName: string): Promise<PackContainer> {
    try {
      return await PackContainer.openFtlDat(source)
    } catch (e) {
      if (!(e instanceof DatFormatError)) throw e

      // Not a PKG. A lone pre-1.6.1 dat can't serve both data/ and img/.
      throw new DatFormatError(
        `"${fileName}" is not an FTL 1.6.1+ "ftl.dat". If this is an older ` +
          `install, select both "data.dat" and "resource.dat" together.`,
      )
    }
  }

  get size(): number {
    return this.packFor('').size
  }

  listPaths(): string[] {
    const seen = new Set<string>()
    for (const [, pack] of this.prefixPacks) {
      for (const path of pack.listPaths()) seen.add(path)
    }
    for (const path of this.fallback.listPaths()) seen.add(path)
    return [...seen]
  }

  has(innerPath: string): boolean {
    return this.packFor(innerPath).has(innerPath)
  }

  getBytes(innerPath: string): Promise<Uint8Array> {
    return this.packFor(innerPath).getBytes(innerPath)
  }

  getText(innerPath: string): Promise<string> {
    return this.packFor(innerPath).getText(innerPath)
  }

  private packFor(innerPath: string): Pack {
    for (const [prefix, pack] of this.prefixPacks) {
      if (innerPath.startsWith(prefix)) return pack
    }
    return this.fallback
  }
}
