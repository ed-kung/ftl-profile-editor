import type { DataPack } from '../datapack'
import {
  generalAchievements,
  parseAchievements,
  type Achievement,
} from './achievements'
import {
  DLC_BLUEPRINT_FILE_NAMES,
  DLC_PLAYER_SHIP_BASE_IDS,
  STD_BLUEPRINT_FILE_NAMES,
  STD_PLAYER_SHIP_BASE_IDS,
  addShipBlueprints,
  buildPlayerShipVariants,
  type ShipBlueprint,
} from './ships'
import { TEXT_LOOKUP_FILE_NAMES, addTextLookups, type TextLookup } from './textLookup'

/**
 * The game data the profile editor needs, parsed and indexed.
 *
 * Stands in for net.blerf.ftl.parser.DataManager, minus everything only the
 * saved-game editor touches (events, sectors, layouts, weapons, drones).
 *
 * "DLC enabled" selects between vanilla and Advanced Edition content. A
 * profile with fileFormat 9 is an AE profile, so the editor runs with DLC on;
 * the vanilla maps are kept for fileFormat 4.
 */
export class GameData {
  private readonly achievementsById: Map<string, Achievement>
  private readonly generalAchs: Achievement[]

  private readonly stdShips: Map<string, ShipBlueprint>
  private readonly dlcShips: Map<string, ShipBlueprint>

  private readonly stdVariants: Map<string, Array<ShipBlueprint | null>>
  private readonly dlcVariants: Map<string, Array<ShipBlueprint | null>>

  private readonly iconUrls = new Map<string, string>()

  private constructor(
    readonly pack: DataPack,
    readonly textLookup: TextLookup,
    private dlcEnabled: boolean,
  ) {
    this.achievementsById = parseAchievements(
      pack.xml['achievements.xml'],
      textLookup,
    )
    this.generalAchs = generalAchievements(this.achievementsById)

    this.stdShips = new Map()
    for (const name of STD_BLUEPRINT_FILE_NAMES) {
      if (pack.xml[name]) {
        addShipBlueprints(this.stdShips, pack.xml[name], name, textLookup)
      }
    }

    this.dlcShips = new Map(this.stdShips)
    for (const name of DLC_BLUEPRINT_FILE_NAMES) {
      if (pack.xml[name]) {
        addShipBlueprints(this.dlcShips, pack.xml[name], name, textLookup)
      }
    }

    this.stdVariants = buildPlayerShipVariants(
      this.stdShips,
      STD_PLAYER_SHIP_BASE_IDS,
      false,
    )
    this.dlcVariants = buildPlayerShipVariants(
      this.dlcShips,
      DLC_PLAYER_SHIP_BASE_IDS,
      true,
    )

    for (const [innerPath, blob] of Object.entries(pack.icons)) {
      this.iconUrls.set(innerPath, URL.createObjectURL(blob))
    }
  }

  static fromPack(pack: DataPack, dlcEnabled = true): GameData {
    const textLookup: TextLookup = new Map()
    for (const name of TEXT_LOOKUP_FILE_NAMES) {
      if (pack.xml[name]) addTextLookups(textLookup, pack.xml[name], name)
    }
    return new GameData(pack, textLookup, dlcEnabled)
  }

  setDLCEnabled(b: boolean): void {
    this.dlcEnabled = b
  }

  isDLCEnabled(): boolean {
    return this.dlcEnabled
  }

  getAchievement(id: string): Achievement | undefined {
    return this.achievementsById.get(id)
  }

  getAchievements(): Map<string, Achievement> {
    return this.achievementsById
  }

  /** Achievements with no ship, in the order the game's data file lists them. */
  getGeneralAchievements(): Achievement[] {
    return this.generalAchs
  }

  getShip(id: string): ShipBlueprint | undefined {
    return (this.dlcEnabled ? this.dlcShips : this.stdShips).get(id)
  }

  getPlayerShipBaseIds(): string[] {
    return this.dlcEnabled ? DLC_PLAYER_SHIP_BASE_IDS : STD_PLAYER_SHIP_BASE_IDS
  }

  /**
   * The nth Type-ABC variant of a player ship.
   *
   * @param n 0=Type-A, 1=Type-B, 2=Type-C
   */
  getPlayerShipVariant(baseId: string, n: number): ShipBlueprint | null {
    const variants = this.dlcEnabled ? this.dlcVariants : this.stdVariants
    return variants.get(baseId)?.[n] ?? null
  }

  /**
   * The achievements tied to a ship variant.
   *
   * Only Type-A variants have any, matching how the game awards them.
   */
  getShipAchievements(ship: ShipBlueprint | null): Achievement[] {
    if (!ship) return []
    return [...this.achievementsById.values()].filter(
      (ach) => ach.shipId === ship.id,
    )
  }

  /** A blob: URL for an icon, e.g. "img/achievements/0.png". */
  getIconUrl(innerPath: string | null): string | null {
    if (!innerPath) return null
    return this.iconUrls.get(innerPath) ?? null
  }

  getAchievementIconUrl(ach: Achievement): string | null {
    return ach.imagePath ? this.getIconUrl(`img/${ach.imagePath}`) : null
  }

  getShipIconUrl(ship: ShipBlueprint | null): string | null {
    if (!ship?.graphicsBaseName) return null
    return this.getIconUrl(`img/ship/${ship.graphicsBaseName}_base.png`)
  }

  /** Releases the blob: URLs handed out for icons. */
  dispose(): void {
    for (const url of this.iconUrls.values()) URL.revokeObjectURL(url)
    this.iconUrls.clear()
  }
}
