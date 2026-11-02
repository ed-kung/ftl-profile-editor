import { beforeAll, describe, expect, it } from 'vitest'

import { GameData } from '../src/lib/data/GameData'
import { describeFirstDifference } from '../src/lib/io/compareBytes'
import { canWriteFormat, readSavedGame, writeSavedGame } from '../src/lib/save/SaveParser'
import { setSystemCapacity } from '../src/lib/save/mutations'
import type { SavedGame } from '../src/lib/save/types'
import {
  MISSING_DATA_MESSAGE,
  hasGameDataFixture,
  listSaveFixtures,
  loadDataPackFixture,
  loadFixture,
} from './fixtures'

/**
 * The tests that can actually catch a misread format: real saves, written by
 * the real game. They need files that aren't in the repository.
 * @see test/fixtures/README.md
 */

const saves = listSaveFixtures()

describe.skipIf(!hasGameDataFixture() || saves.length === 0)(
  `real saved games (${saves.length}) ${hasGameDataFixture() ? '' : MISSING_DATA_MESSAGE}`,
  () => {
    let data: GameData

    beforeAll(() => {
      data = GameData.fromPack(loadDataPackFixture())
    })

    it.each(saves)('%s comes back byte for byte', (name) => {
      const bytes = loadFixture(name)
      const game = readSavedGame(bytes, data)

      if (!canWriteFormat(game.fileFormat)) return

      expect(describeFirstDifference(bytes, writeSavedGame(game))).toBeNull()
    })

    it.each(saves)('%s survives a structural edit', (name) => {
      const game = readSavedGame(loadFixture(name), data)
      if (!canWriteFormat(game.fileFormat)) return

      const index = game.playerShip.systems.findIndex((s) => s.capacity === 0)
      if (index < 0) return

      const edited: SavedGame = {
        ...game,
        playerShip: setSystemCapacity(game.playerShip, index, 1, game.fileFormat),
      }

      expect(readSavedGame(writeSavedGame(edited), data)).toEqual(edited)
    })
  },
)
