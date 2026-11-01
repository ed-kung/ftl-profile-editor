/**
 * windows-1252 encoding.
 *
 * TextDecoder handles the decode direction natively, but TextEncoder only ever
 * emits UTF-8, so the encode direction has to be done by hand. FTL profiles
 * before fileFormat 9 (FTL 1.01-1.03.3) store their strings in this codepage.
 *
 * @see net.blerf.ftl.parser.Parser#writeString
 */

/** The 0x80-0x9F range, where windows-1252 differs from latin-1. */
const HIGH_RANGE = [
  0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8d, 0x017d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x9d, 0x017e, 0x0178,
]

const CODEPOINT_TO_BYTE = new Map<number, number>()
for (let i = 0; i < HIGH_RANGE.length; i++) {
  CODEPOINT_TO_BYTE.set(HIGH_RANGE[i], 0x80 + i)
}

export class UnencodableCharacterError extends Error {
  constructor(
    readonly char: string,
    readonly index: number,
  ) {
    super(
      `Character ${JSON.stringify(char)} at index ${index} cannot be written to a ` +
        `windows-1252 profile. Only this FTL version's own character set is safe here.`,
    )
    this.name = 'UnencodableCharacterError'
  }
}

/**
 * Encodes a string as windows-1252 bytes.
 *
 * Throws rather than substituting "?" for characters outside the codepage: a
 * silently mangled crew name is worse than a refusal to save.
 */
export function encodeCp1252(str: string): Uint8Array {
  const out = new Uint8Array(str.length)
  let len = 0

  for (const char of str) {
    const cp = char.codePointAt(0)!

    if (cp <= 0x7f || (cp >= 0xa0 && cp <= 0xff)) {
      out[len++] = cp
      continue
    }

    const mapped = CODEPOINT_TO_BYTE.get(cp)
    if (mapped === undefined) {
      throw new UnencodableCharacterError(char, len)
    }
    out[len++] = mapped
  }

  // Astral characters would need more than one slot each, but they can never be
  // encoded, so len <= str.length always holds by the time we get here.
  return out.subarray(0, len)
}

/**
 * Decodes windows-1252 bytes.
 *
 * Browsers have `TextDecoder('windows-1252')`, but Node's build of it maps the
 * 0x80-0x9F range as latin-1 -- 0x93 comes back as U+0093 rather than the left
 * double quote. Decoding from the same table used to encode keeps the two
 * directions symmetric and the behaviour identical everywhere.
 */
export function decodeCp1252(bytes: Uint8Array): string {
  let out = ''

  for (const byte of bytes) {
    out +=
      byte >= 0x80 && byte <= 0x9f
        ? String.fromCodePoint(HIGH_RANGE[byte - 0x80])
        : String.fromCodePoint(byte)
  }

  return out
}
