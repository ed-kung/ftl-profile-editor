import type { Pack } from './dat/PackContainer'
import { toBlob } from './io/blob'
import { parseAchievements } from './data/achievements'
import { SECTOR_DATA_FILE_NAME } from './data/sectors'
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
 * The slice of an FTL install the editors actually need.
 *
 * "ftl.dat" is 278MB, of which this is a few megabytes at most once the icons
 * have been downscaled. Extracting it once and caching the result means the
 * user picks their game directory a single time, per pack schema.
 */
export interface DataPack {
  /** A cached pack from another schema is ignored. @see DATA_PACK_SCHEMA */
  readonly schemaVersion: number
  /** Identifies the install this came from, so a changed dat invalidates it. */
  readonly source: DataPackSource
  /** Inner path (without "data/") to file contents. */
  readonly xml: Record<string, string>
  /** Layout id (e.g. "kestral") to the text of "data/<id>.txt". */
  readonly layouts: Record<string, string>
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

/**
 * Bump whenever the pack's contents change.
 *
 * 1 had no schema field at all. 2 added ship layouts and
 * sector data for saved games.
 */
export const DATA_PACK_SCHEMA = 2

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
    SECTOR_DATA_FILE_NAME,
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

  onProgress('Reading ship layouts')
  const { ships, lookup } = parseShips(xml)
  const layouts: Record<string, string> = {}
  for (const ship of ships.values()) {
    if (!ship.layoutId || layouts[ship.layoutId] !== undefined) continue

    const innerPath = `data/${ship.layoutId}.txt`
    if (pack.has(innerPath)) layouts[ship.layoutId] = await pack.getText(innerPath)
  }

  onProgress('Finding icons')
  const iconPaths = collectIconPaths(xml, ships, lookup)

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
    schemaVersion: DATA_PACK_SCHEMA,
    source: { ...source, extractedAt: Date.now() },
    xml,
    layouts,
    icons,
  }
}

function parseShips(xml: Record<string, string>): {
  ships: Map<string, ShipBlueprint>
  lookup: TextLookup
} {
  const lookup: TextLookup = new Map()
  for (const name of TEXT_LOOKUP_FILE_NAMES) {
    if (xml[name]) addTextLookups(lookup, xml[name], name)
  }

  const ships = new Map<string, ShipBlueprint>()
  for (const name of BLUEPRINT_FILE_NAMES) {
    if (xml[name]) addShipBlueprints(ships, xml[name], name, lookup)
  }

  return { ships, lookup }
}

/** Every icon the profile tabs will want to display. */
function collectIconPaths(
  xml: Record<string, string>,
  ships: Map<string, ShipBlueprint>,
  lookup: TextLookup,
): string[] {
  const paths = new Set<string>()

  for (const ach of parseAchievements(xml['achievements.xml'], lookup).values()) {
    if (ach.imagePath) paths.add(`img/${ach.imagePath}`)
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
