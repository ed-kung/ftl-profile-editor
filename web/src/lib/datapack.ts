import type { Pack } from './dat/PackContainer'
import { toBlob } from './io/blob'
import { parseAchievements } from './data/achievements'
import {
  DLC_BLUEPRINT_FILE_NAMES,
  DLC_PLAYER_SHIP_BASE_IDS,
  STD_BLUEPRINT_FILE_NAMES,
  addShipBlueprints,
  type ShipBlueprint,
} from './data/ships'
import {
  TEXT_LOOKUP_FILE_NAMES,
  addTextLookups,
  type TextLookup,
} from './data/textLookup'

/**
 * The slice of an FTL install the profile editor actually needs.
 *
 * "ftl.dat" is 278MB, of which this is well under a megabyte once the icons
 * have been downscaled. Extracting it once and caching the result means the
 * user picks their game directory a single time, ever.
 */
export interface DataPack {
  /** Identifies the install this came from, so a changed dat invalidates it. */
  readonly source: DataPackSource
  /** Inner path (without "data/") to file contents. */
  readonly xml: Record<string, string>
  /** Inner path (e.g. "img/achievements/0.png") to a downscaled PNG. */
  readonly icons: Record<string, Blob>
}

export interface DataPackSource {
  fileName: string
  fileSize: number
  lastModified: number
  /** Set when the pack was built, for display. */
  extractedAt: number
}

/** Icons are stored at twice their display box, for HiDPI screens. */
const ICON_MAX_EDGE = 128

const BLUEPRINT_FILE_NAMES = [
  ...STD_BLUEPRINT_FILE_NAMES,
  ...DLC_BLUEPRINT_FILE_NAMES,
]

export interface ExtractProgress {
  (stage: string): void
}

/**
 * Pulls the needed files out of an opened archive and downscales the icons.
 *
 * Missing files are skipped rather than fatal: "bosses.xml" and the DLC
 * blueprints only exist on some versions, and the Java editor skips absent
 * resources the same way.
 */
export async function extractDataPack(
  pack: Pack,
  source: Omit<DataPackSource, 'extractedAt'>,
  onProgress: ExtractProgress = () => {},
): Promise<DataPack> {
  const xml: Record<string, string> = {}

  onProgress('Reading text')
  for (const name of [
    ...TEXT_LOOKUP_FILE_NAMES,
    'achievements.xml',
    ...BLUEPRINT_FILE_NAMES,
  ]) {
    const innerPath = `data/${name}`
    if (!pack.has(innerPath)) continue
    xml[name] = await pack.getText(innerPath)
  }

  if (!xml['achievements.xml']) {
    throw new Error(
      'This archive has no "data/achievements.xml" -- it does not look like an FTL resource file.',
    )
  }
  if (!xml['blueprints.xml']) {
    throw new Error(
      'This archive has no "data/blueprints.xml" -- it does not look like an FTL resource file.',
    )
  }

  onProgress('Finding icons')
  const iconPaths = collectIconPaths(xml)

  const icons: Record<string, Blob> = {}
  let done = 0
  for (const innerPath of iconPaths) {
    if (!pack.has(innerPath)) continue

    const raw = await pack.getBytes(innerPath)
    icons[innerPath] = await downscalePng(raw, ICON_MAX_EDGE)

    done++
    if (done % 10 === 0) {
      onProgress(`Scaling icons (${done}/${iconPaths.length})`)
    }
  }

  return {
    source: { ...source, extractedAt: Date.now() },
    xml,
    icons,
  }
}

/** Every icon the profile tabs will want to display. */
function collectIconPaths(xml: Record<string, string>): string[] {
  const lookup: TextLookup = new Map()
  for (const name of TEXT_LOOKUP_FILE_NAMES) {
    if (xml[name]) addTextLookups(lookup, xml[name], name)
  }

  const paths = new Set<string>()

  for (const ach of parseAchievements(xml['achievements.xml'], lookup).values()) {
    if (ach.imagePath) paths.add(`img/${ach.imagePath}`)
  }

  const ships = new Map<string, ShipBlueprint>()
  for (const name of BLUEPRINT_FILE_NAMES) {
    if (xml[name]) addShipBlueprints(ships, xml[name], name, lookup)
  }

  for (const baseId of DLC_PLAYER_SHIP_BASE_IDS) {
    for (const variantId of [baseId, `${baseId}_2`, `${baseId}_3`]) {
      const gfx = ships.get(variantId)?.graphicsBaseName
      if (gfx) paths.add(`img/ship/${gfx}_base.png`)
    }
  }

  return [...paths]
}

/**
 * Re-encodes a PNG at no more than `maxEdge` on its longer side.
 *
 * The ship hulls are the reason this exists: at full size they are 2.2MB
 * between them, against 200KB or so once scaled to icon dimensions.
 */
async function downscalePng(raw: Uint8Array, maxEdge: number): Promise<Blob> {
  const original = toBlob(raw, 'image/png')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(original)
  } catch {
    // Not decodable here; keep the bytes so the UI can still try an <img>.
    return original
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  if (scale === 1) {
    bitmap.close()
    return original
  }

  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return original
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return canvas.convertToBlob({ type: 'image/png' })
}
