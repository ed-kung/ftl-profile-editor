/** Describes the first difference between a file and its rewrite, or null. */
export function describeFirstDifference(
  original: Uint8Array,
  rewritten: Uint8Array,
): string | null {
  const limit = Math.min(original.length, rewritten.length)

  for (let i = 0; i < limit; i++) {
    if (original[i] !== rewritten[i]) {
      return (
        `Rewriting the file unchanged produced different bytes, starting at ` +
        `offset ${i} (original 0x${hex(original[i])}, rewritten 0x${hex(rewritten[i])}).`
      )
    }
  }

  if (original.length === rewritten.length) return null

  return (
    `Rewriting the file unchanged produced ${rewritten.length} bytes ` +
    `instead of ${original.length}.`
  )
}

function hex(byte: number): string {
  return byte.toString(16).padStart(2, '0')
}
