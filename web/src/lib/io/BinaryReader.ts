import { decodeCp1252 } from './cp1252'

/**
 * Reads the little-endian primitives FTL's user files are built from.
 *
 * A port of the read half of net.blerf.ftl.parser.Parser. The Java version
 * works over an InputStream and has to guess at remaining length to avoid
 * allocating absurd string buffers; here the whole file is already in memory,
 * so bounds are known exactly.
 */
export class BinaryReader {
  private pos = 0
  private readonly view: DataView
  private unicode = false

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  /** 0-based offset of the next byte to be read. */
  get offset(): number {
    return this.pos
  }

  get length(): number {
    return this.bytes.length
  }

  get bytesRemaining(): number {
    return this.bytes.length - this.pos
  }

  get atEnd(): boolean {
    return this.pos === this.bytes.length
  }

  /**
   * Toggles string encoding between windows-1252 (default) and UTF-8.
   *
   * Unicode strings were introduced in FTL 1.6.1.
   */
  setUnicode(b: boolean): void {
    this.unicode = b
  }

  isUnicode(): boolean {
    return this.unicode
  }

  readInt(): number {
    this.require(4, 'an int')
    const v = this.view.getInt32(this.pos, true)
    this.pos += 4
    return v
  }

  readBool(): boolean {
    const at = this.pos
    const i = this.readInt()
    if (i !== 0 && i !== 1) {
      throw new ParseError(`Not a bool: ${i}`, at)
    }
    return i === 1
  }

  /** Reads a little-endian int bytecount followed by that many string bytes. */
  readString(): string {
    const at = this.pos
    const byteCount = this.readInt()

    if (byteCount < 0) {
      throw new ParseError(`Negative string length: ${byteCount}`, at)
    }
    if (byteCount > this.bytesRemaining) {
      throw new ParseError(
        `Expected string length (${byteCount}) would extend ${byteCount - this.bytesRemaining} ` +
          `bytes beyond the end of the file`,
        at,
      )
    }

    const raw = this.bytes.subarray(this.pos, this.pos + byteCount)
    this.pos += byteCount

    return this.unicode ? UTF8_DECODER.decode(raw) : decodeCp1252(raw)
  }

  /** Consumes and returns the rest of the file. */
  readRemaining(): Uint8Array {
    const rest = this.bytes.subarray(this.pos)
    this.pos = this.bytes.length
    return rest
  }

  private require(n: number, what: string): void {
    if (this.bytesRemaining < n) {
      throw new ParseError(
        `End of file reached before reading enough bytes for ${what}`,
        this.pos,
      )
    }
  }
}

const UTF8_DECODER = new TextDecoder('utf-8')

/** A failure to make sense of a file, tagged with where it went wrong. */
export class ParseError extends Error {
  constructor(
    message: string,
    readonly offset: number,
  ) {
    super(`${message} (at offset ${offset})`)
    this.name = 'ParseError'
  }
}
