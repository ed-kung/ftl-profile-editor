import { beforeAll, describe, expect, it } from 'vitest'

import { GameData } from '../src/lib/data/GameData'
import { DLC_PLAYER_SHIP_BASE_IDS } from '../src/lib/data/ships'
import {
  MISSING_DATA_MESSAGE,
  hasGameDataFixture,
  loadDataPackFixture,
} from './fixtures'

describe.skipIf(!hasGameDataFixture())(`GameData (${MISSING_DATA_MESSAGE})`, () => {
  // Loaded lazily: skipIf still evaluates this callback, so reading fixtures
  // out here would break collection on a machine without them.
  let data: GameData
  beforeAll(() => {
    data = GameData.fromPack(loadDataPackFixture())
  })

  it('resolves deferred achievement text through the central lookup', () => {
    const ach = data.getAchievement('ACH_SECTOR_5')
    expect(ach?.name).toBe('Just Getting Started')
    expect(ach?.description).toBe('Get to sector 5.')
    expect(ach?.imagePath).toBe('achievements/0.png')
  })

  it('flags one victory achievement per unlockable ship', () => {
    const victories = [...data.getAchievements().values()].filter((a) => a.victory)
    expect(victories).toHaveLength(DLC_PLAYER_SHIP_BASE_IDS.length)
  })

  it('flags quest achievements for the seven ships that have one', () => {
    const quests = [...data.getAchievements().values()].filter((a) => a.quest)
    expect(quests.map((a) => a.shipId).sort()).toEqual([
      'PLAYER_SHIP_CRYSTAL',
      'PLAYER_SHIP_ENERGY',
      'PLAYER_SHIP_FED',
      'PLAYER_SHIP_JELLY',
      'PLAYER_SHIP_MANTIS',
      'PLAYER_SHIP_ROCK',
      'PLAYER_SHIP_STEALTH',
    ])
  })

  it('synthesises victory achievements, since the data files have none', () => {
    // Load-bearing: the `victory` flag decides whether three extra ints are
    // read from each record, so these ids must exist for parsing to line up.
    const ach = data.getAchievement('PLAYER_SHIP_HARD_VICTORY')
    expect(ach?.victory).toBe(true)
    expect(ach?.shipId).toBe('PLAYER_SHIP_HARD')
  })

  it('groups the general achievements into the three rows the UI shows', () => {
    // The tab indexes this list at offsets 0, 7 and 14.
    expect(data.getGeneralAchievements().length).toBeGreaterThanOrEqual(21)
  })

  it('resolves every player ship variant except the two without a Type-C', () => {
    for (const baseId of data.getPlayerShipBaseIds()) {
      expect(data.getPlayerShipVariant(baseId, 0), `${baseId} Type-A`).not.toBeNull()
      expect(data.getPlayerShipVariant(baseId, 1), `${baseId} Type-B`).not.toBeNull()

      const typeC = data.getPlayerShipVariant(baseId, 2)
      const expectNull =
        baseId === 'PLAYER_SHIP_CRYSTAL' || baseId === 'PLAYER_SHIP_ANAEROBIC'
      if (expectNull) {
        expect(typeC, `${baseId} Type-C`).toBeNull()
      } else {
        expect(typeC, `${baseId} Type-C`).not.toBeNull()
      }
    }
  })

  it('layers the DLC blueprints over the stock ones', () => {
    // The Kestrel's Type-C only exists in dlcBlueprintsOverwrite.xml.
    const kestrelC = data.getPlayerShipVariant('PLAYER_SHIP_HARD', 2)
    expect(kestrelC?.id).toBe('PLAYER_SHIP_HARD_3')
    expect(kestrelC?.graphicsBaseName).toBe('kestral_3')
  })

  it('resolves ship class names through the text lookup', () => {
    const kestrel = data.getPlayerShipVariant('PLAYER_SHIP_HARD', 0)
    expect(kestrel?.shipClass).toBe('Kestrel Cruiser')
    expect(kestrel?.layoutId).toBe('kestral')
  })

  it('ties three editable achievements to each ship, plus quest and victory', () => {
    const kestrel = data.getPlayerShipVariant('PLAYER_SHIP_HARD', 0)
    const achs = data.getShipAchievements(kestrel)
    const editable = achs.filter((a) => !a.victory && !a.quest)
    expect(editable).toHaveLength(3)
  })

  it('leaves vanilla data without the Lanius Cruiser', () => {
    const vanilla = GameData.fromPack(loadDataPackFixture(), false)
    expect(vanilla.getPlayerShipBaseIds()).not.toContain('PLAYER_SHIP_ANAEROBIC')
    expect(vanilla.getPlayerShipVariant('PLAYER_SHIP_HARD', 2)).toBeNull()
  })
})
