import { toBlob } from './blob'

/** Hands the browser a file to save. */
export function download(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(toBlob(bytes, 'application/octet-stream'))

  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()

  // Give the browser a moment to start the download before dropping the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
