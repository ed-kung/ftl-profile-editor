import { childElement, parseXml } from './xml'
import { resolveText, type TextLookup } from './textLookup'

/**
 * The item blueprints a saved game refers to by id.
 *
 * Only drones matter to the file format: a drone's type decides the shape of
 * its pod. The rest supply names and dropdown choices.
 */

export interface ItemBlueprint {
  id: string
  title: string | null
}

export interface DroneBlueprint extends ItemBlueprint {
  /** E.g. "COMBAT". @see DRONE_TYPES in save/types.ts */
  type: string | null
}

export interface SystemBlueprint extends ItemBlueprint {
  maxPower: number | null
}

export interface ItemBlueprints {
  weapons: Map<string, ItemBlueprint>
  drones: Map<string, DroneBlueprint>
  augments: Map<string, ItemBlueprint>
  crew: Map<string, ItemBlueprint>
  systems: Map<string, SystemBlueprint>
}

export function emptyItemBlueprints(): ItemBlueprints {
  return {
    weapons: new Map(),
    drones: new Map(),
    augments: new Map(),
    crew: new Map(),
    systems: new Map(),
  }
}

export function copyItemBlueprints(from: ItemBlueprints): ItemBlueprints {
  return {
    weapons: new Map(from.weapons),
    drones: new Map(from.drones),
    augments: new Map(from.augments),
    crew: new Map(from.crew),
    systems: new Map(from.systems),
  }
}

/**
 * Collects item blueprints from one blueprints file into `into`.
 *
 * Later files overwrite earlier ones by id, as with ships.
 */
export function addItemBlueprints(
  into: ItemBlueprints,
  xmlText: string,
  fileName: string,
  lookup: TextLookup,
): void {
  const doc = parseXml(xmlText, fileName)

  const each = (tagName: string, visit: (id: string, el: Element) => void) => {
    for (const el of Array.from(doc.getElementsByTagName(tagName))) {
      const id = el.getAttribute('name')
      if (id) visit(id, el)
    }
  }
  const title = (el: Element) => resolveText(childElement(el, 'title'), lookup)
  const text = (el: Element, tagName: string) =>
    childElement(el, tagName)?.textContent?.trim() ?? null

  each('weaponBlueprint', (id, el) => {
    into.weapons.set(id, { id, title: title(el) })
  })
  each('droneBlueprint', (id, el) => {
    into.drones.set(id, { id, title: title(el), type: text(el, 'type') })
  })
  each('augBlueprint', (id, el) => {
    into.augments.set(id, { id, title: title(el) })
  })
  each('crewBlueprint', (id, el) => {
    into.crew.set(id, { id, title: title(el) })
  })
  each('systemBlueprint', (id, el) => {
    const maxPower = Number(text(el, 'maxPower'))
    into.systems.set(id, {
      id,
      title: title(el),
      maxPower: Number.isInteger(maxPower) && maxPower > 0 ? maxPower : null,
    })
  })
}
