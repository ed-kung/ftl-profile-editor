import { childElement, parseXml } from './xml'
import { resolveText, type TextLookup } from './textLookup'

export interface ShipBlueprint {
  id: string
  /** The layout basename, e.g. "kestral" -- "data/<layoutId>.txt" / ".xml". */
  layoutId: string | null
  /** The graphics basename, e.g. "kestral" -- "img/ship/<name>_base.png". */
  graphicsBaseName: string | null
  name: string | null
  shipClass: string | null
  description: string | null
  /**
   * The rooms each system can occupy, by system id (e.g. "pilot").
   *
   * A system without an entry has no room on this ship, so can't be installed.
   * Artillery is the one system that can fill several rooms, as on the rebel
   * flagship; each room adds a system record to a saved game.
   */
  systemRooms: Record<string, number[]>
}

/** Blueprint files that are always in effect, in load order. */
export const STD_BLUEPRINT_FILE_NAMES = [
  'blueprints.xml',
  'autoBlueprints.xml',
  'bosses.xml', // FTL 1.5.4+
]

/** Blueprint files layered on top when Advanced Edition content is enabled. */
export const DLC_BLUEPRINT_FILE_NAMES = [
  'dlcBlueprints.xml',
  'dlcBlueprintsOverwrite.xml',
  'dlcPirateBlueprints.xml',
]

// The nine ships the original game could unlock, in the order the profile
// stores them. @see net.blerf.ftl.parser.DefaultDataManager
export const STD_PLAYER_SHIP_BASE_IDS = [
  'PLAYER_SHIP_HARD',
  'PLAYER_SHIP_STEALTH',
  'PLAYER_SHIP_MANTIS',
  'PLAYER_SHIP_CIRCLE',
  'PLAYER_SHIP_FED',
  'PLAYER_SHIP_JELLY',
  'PLAYER_SHIP_ROCK',
  'PLAYER_SHIP_ENERGY',
  'PLAYER_SHIP_CRYSTAL',
]

/** Advanced Edition adds the Lanius Cruiser. */
export const DLC_PLAYER_SHIP_BASE_IDS = [
  ...STD_PLAYER_SHIP_BASE_IDS,
  'PLAYER_SHIP_ANAEROBIC',
]

/** The two ships with no Type-C layout. */
const NO_TYPE_C = new Set(['PLAYER_SHIP_CRYSTAL', 'PLAYER_SHIP_ANAEROBIC'])

/**
 * Collects <shipBlueprint> elements from one blueprints file into `into`.
 *
 * Later files overwrite earlier ones by id, which is how
 * "dlcBlueprintsOverwrite.xml" replaces stock ships with their AE versions.
 */
export function addShipBlueprints(
  into: Map<string, ShipBlueprint>,
  xmlText: string,
  fileName: string,
  lookup: TextLookup,
): void {
  const doc = parseXml(xmlText, fileName)

  for (const el of Array.from(doc.getElementsByTagName('shipBlueprint'))) {
    const id = el.getAttribute('name')
    if (!id) continue

    const systemRooms: Record<string, number[]> = {}
    const systemList = childElement(el, 'systemList')
    for (const systemEl of systemList ? Array.from(systemList.children) : []) {
      const room = Number(systemEl.getAttribute('room'))
      if (!Number.isInteger(room)) continue

      ;(systemRooms[systemEl.tagName] ??= []).push(room)
    }

    into.set(id, {
      id,
      layoutId: el.getAttribute('layout'),
      graphicsBaseName: el.getAttribute('img'),
      name: resolveText(childElement(el, 'name'), lookup),
      shipClass: resolveText(childElement(el, 'class'), lookup),
      description: resolveText(childElement(el, 'desc'), lookup),
      systemRooms,
    })
  }
}

/**
 * The Type-A/B/C variants of each unlockable ship.
 *
 * Index 0 is Type-A (the base id), 1 is Type-B ("<baseId>_2"), 2 is Type-C
 * ("<baseId>_3"). A slot is null where that variant does not exist -- the
 * Crystal and Lanius cruisers have no Type-C.
 */
export function buildPlayerShipVariants(
  ships: Map<string, ShipBlueprint>,
  baseIds: string[],
  includeTypeC: boolean,
): Map<string, Array<ShipBlueprint | null>> {
  const variants = new Map<string, Array<ShipBlueprint | null>>()

  for (const baseId of baseIds) {
    const list: Array<ShipBlueprint | null> = [
      ships.get(baseId) ?? null,
      // Every ship has a Type-B layout.
      ships.get(`${baseId}_2`) ?? null,
    ]

    if (includeTypeC) {
      list.push(NO_TYPE_C.has(baseId) ? null : ships.get(`${baseId}_3`) ?? null)
    }

    variants.set(baseId, list)
  }

  return variants
}
