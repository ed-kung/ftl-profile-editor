import { childElement, parseXml } from './xml'
import { resolveText, type TextLookup } from './textLookup'

export interface Achievement {
  id: string
  name: string | null
  shortName: string | null
  description: string | null
  /** Relative to "img/", e.g. "achievements/0.png". Null for synthesised ones. */
  imagePath: string | null
  /** The ship this achievement belongs to, or null if it is a general one. */
  shipId: string | null
  multiDifficulty: number
  /**
   * Ship Victory achievements track every variant that earned them, which adds
   * three ints to their record in the profile.
   */
  victory: boolean
  /** Ship Quest achievements, which don't unlock ship variants. */
  quest: boolean
}

// Which ships have quest and victory achievements. Hardcoded in the Java
// editor too -- these ids appear nowhere in the game's own data files.
// @see net.blerf.ftl.parser.DefaultDataManager
const QUEST_ACH_IDS: Array<[string, string]> = [
  // No Kestrel quest.
  ['PLAYER_SHIP_STEALTH', 'PLAYER_SHIP_STEALTH_QUEST'],
  ['PLAYER_SHIP_MANTIS', 'PLAYER_SHIP_MANTIS_QUEST'],
  // No Engi quest.
  ['PLAYER_SHIP_FED', 'PLAYER_SHIP_FED_QUEST'],
  ['PLAYER_SHIP_JELLY', 'PLAYER_SHIP_JELLY_QUEST'],
  ['PLAYER_SHIP_ROCK', 'PLAYER_SHIP_ROCK_QUEST'],
  ['PLAYER_SHIP_ENERGY', 'PLAYER_SHIP_ENERGY_QUEST'],
  ['PLAYER_SHIP_CRYSTAL', 'PLAYER_SHIP_CRYSTAL_QUEST'],
  // No Anaerobic quest.
]

const VICTORY_ACH_IDS: Array<[string, string]> = [
  ['PLAYER_SHIP_HARD', 'PLAYER_SHIP_HARD_VICTORY'],
  ['PLAYER_SHIP_STEALTH', 'PLAYER_SHIP_STEALTH_VICTORY'],
  ['PLAYER_SHIP_MANTIS', 'PLAYER_SHIP_MANTIS_VICTORY'],
  ['PLAYER_SHIP_CIRCLE', 'PLAYER_SHIP_CIRCLE_VICTORY'],
  ['PLAYER_SHIP_FED', 'PLAYER_SHIP_FED_VICTORY'],
  ['PLAYER_SHIP_JELLY', 'PLAYER_SHIP_JELLY_VICTORY'],
  ['PLAYER_SHIP_ROCK', 'PLAYER_SHIP_ROCK_VICTORY'],
  ['PLAYER_SHIP_ENERGY', 'PLAYER_SHIP_ENERGY_VICTORY'],
  ['PLAYER_SHIP_CRYSTAL', 'PLAYER_SHIP_CRYSTAL_VICTORY'],
  ['PLAYER_SHIP_ANAEROBIC', 'PLAYER_SHIP_ANAEROBIC_VICTORY'],
]

/**
 * Parses "achievements.xml" and flags the quest and victory achievements.
 *
 * Insertion order is preserved: the General Achievements tab indexes the
 * general ones positionally, exactly as the Swing panel does.
 *
 * The flagging deliberately reproduces DefaultDataManager's behaviour rather
 * than its apparent intent. It looks up each *ship* id in a map keyed by
 * *achievement* id, so the lookup always misses and a dummy achievement is
 * always synthesised. That matters beyond cosmetics: whether an id is flagged
 * `victory` decides if three extra ints are read from the profile, so
 * "correcting" this would desynchronise the byte stream against real files.
 */
export function parseAchievements(
  xmlText: string,
  lookup: TextLookup,
): Map<string, Achievement> {
  const doc = parseXml(xmlText, 'achievements.xml')
  const byId = new Map<string, Achievement>()

  for (const el of Array.from(doc.getElementsByTagName('achievement'))) {
    const id = el.getAttribute('id')
    if (!id) continue

    const multiDifficulty = childElement(el, 'multiDifficulty')?.textContent

    byId.set(id, {
      id,
      name: resolveText(childElement(el, 'name'), lookup),
      shortName: resolveText(childElement(el, 'shortName'), lookup),
      description: resolveText(childElement(el, 'desc'), lookup),
      imagePath: childElement(el, 'img')?.textContent?.trim() || null,
      shipId: childElement(el, 'ship')?.textContent?.trim() || null,
      multiDifficulty: multiDifficulty ? Number(multiDifficulty) : 0,
      victory: false,
      quest: false,
    })
  }

  for (const [shipId, achId] of QUEST_ACH_IDS) {
    const ach = findOrSynthesise(byId, shipId, achId, 'quest')
    ach.quest = true
  }

  for (const [shipId, achId] of VICTORY_ACH_IDS) {
    const ach = findOrSynthesise(byId, shipId, achId, 'victory')
    ach.victory = true
  }

  return byId
}

function findOrSynthesise(
  byId: Map<string, Achievement>,
  shipId: string,
  achId: string,
  kind: 'quest' | 'victory',
): Achievement {
  const existing = byId.get(shipId)
  if (existing) return existing

  const synthesised: Achievement = {
    id: achId,
    name: achId,
    shortName: null,
    description: `Dummy ${kind} achievement.`,
    imagePath: null,
    shipId,
    multiDifficulty: 0,
    victory: false,
    quest: false,
  }
  byId.set(achId, synthesised)
  return synthesised
}

/** Achievements not tied to any ship, in document order. */
export function generalAchievements(
  byId: Map<string, Achievement>,
): Achievement[] {
  return [...byId.values()].filter((ach) => ach.shipId === null)
}
