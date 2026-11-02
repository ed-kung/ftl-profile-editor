import { childElement, childElements, parseXml } from './xml'
import { resolveText, type TextLookup } from './textLookup'

/**
 * The sectors a tree can be generated from: "data/sector_data.xml".
 *
 * Only needed to reconstruct a sector tree from its seed.
 * A port of the parts of DefaultDataManager and RandomSectorTreeGenerator that
 * read this file.
 */

export const SECTOR_DATA_FILE_NAME = 'sector_data.xml'

export interface SectorChoice {
  id: string
  unique: boolean
  /** The first column this sector can appear in. */
  minSector: number
  titles: string[]
}

export interface SectorPools {
  CIVILIAN: SectorChoice[]
  NEBULA: SectorChoice[]
  HOSTILE: SectorChoice[]
}

const OVERRIDE_PREFIX = 'OVERRIDE_'

export function parseSectorPools(
  xmlText: string,
  lookup: TextLookup,
  dlcEnabled: boolean,
): SectorPools {
  const doc = parseXml(xmlText, SECTOR_DATA_FILE_NAME)

  const choices = new Map<string, SectorChoice>()
  for (const el of Array.from(doc.getElementsByTagName('sectorDescription'))) {
    const id = el.getAttribute('name')
    if (!id) continue

    const nameList = childElement(el, 'nameList')
    const titles = nameList
      ? childElements(nameList, 'name').flatMap((nameEl) => {
          const title = resolveText(nameEl, lookup)
          return title ? [title] : []
        })
      : []

    choices.set(id, {
      id,
      unique: el.getAttribute('unique') === 'true',
      minSector: Number(el.getAttribute('minSector') ?? 0),
      titles,
    })
  }

  // "OVERRIDE_X" replaces "X" when Advanced Edition content is enabled.
  const sectorIdsByType = new Map<string, string[]>()
  const overrides = new Map<string, string[]>()
  for (const el of Array.from(doc.getElementsByTagName('sectorType'))) {
    const id = el.getAttribute('name')
    if (!id) continue

    const sectorIds = childElements(el, 'sector').flatMap((sectorEl) => {
      const sectorId = sectorEl.textContent?.trim()
      return sectorId ? [sectorId] : []
    })

    if (id.startsWith(OVERRIDE_PREFIX)) {
      overrides.set(id.slice(OVERRIDE_PREFIX.length), sectorIds)
    } else {
      sectorIdsByType.set(id, sectorIds)
    }
  }

  if (dlcEnabled) {
    for (const [id, sectorIds] of overrides) sectorIdsByType.set(id, sectorIds)
  }

  const pool = (typeId: string): SectorChoice[] =>
    (sectorIdsByType.get(typeId) ?? []).flatMap((id) => {
      const choice = choices.get(id)
      return choice ? [choice] : []
    })

  return {
    CIVILIAN: pool('CIVILIAN'),
    NEBULA: pool('NEBULA'),
    HOSTILE: pool('HOSTILE'),
  }
}
