/**
 * Hands a Uint8Array to the Blob constructor.
 *
 * TypeScript 5.7 made Uint8Array generic over its backing buffer, and BlobPart
 * only accepts the ArrayBuffer flavour. Every array here comes from a file read
 * or a plain allocation, never a SharedArrayBuffer, so the cast is sound -- and
 * doing it in one named place beats scattering it through the call sites.
 */
export function toBlobPart(bytes: Uint8Array): BlobPart {
  return bytes as unknown as BlobPart
}

export function toBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([toBlobPart(bytes)], { type })
}
