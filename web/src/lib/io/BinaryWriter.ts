import { encodeCp1252 } from './cp1252'

/**
 * Writes the little-endian primitives FTL's user files are built from.
 *
 * A port of the write half of net.blerf.ftl.parser.Parser.
 */
export class BinaryWriter {
  private buf = new Uint8Array(4096)
  private view = new DataView(this.buf.buffer)
  private len = 0
  private unicode = false

  get length(): number {
    return this.len
  }

  setUnicode(b: boolean): void {
    this.unicode = b
  }

  isUnicode(): boolean {
    return this.unicode
  }

  writeInt(value: number): void {
    this.grow(4)
    this.view.setInt32(this.len, value, true)
    this.len += 4
  }

  writeBool(b: boolean): void {
    this.writeInt(b ? 1 : 0)
  }

  /** Writes a little-endian int bytecount followed by the string's bytes. */
  writeString(str: string): void {
    const bytes = this.unicode ? UTF8_ENCODER.encode(str) : encodeCp1252(str)
    this.writeInt(bytes.length)
    this.writeBytes(bytes)
  }

  writeBytes(bytes: Uint8Array): void {
    this.grow(bytes.length)
    this.buf.set(bytes, this.len)
    this.len += bytes.length
  }

  /** Returns a copy of everything written so far. */
  toBytes(): Uint8Array {
    return this.buf.slice(0, this.len)
  }

  private grow(extra: number): void {
    if (this.len + extra <= this.buf.length) return

    let capacity = this.buf.length * 2
    while (capacity < this.len + extra) capacity *= 2

    const bigger = new Uint8Array(capacity)
    bigger.set(this.buf.subarray(0, this.len))
    this.buf = bigger
    this.view = new DataView(bigger.buffer)
  }
}

const UTF8_ENCODER = new TextEncoder()
