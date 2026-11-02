import { describe, expect, it } from 'vitest'

import { parseShipLayout } from '../src/lib/data/shipLayout'
import { BinaryWriter } from '../src/lib/io/BinaryWriter'
import {
  canWriteFormat,
  readSavedGame,
  writeSavedGame,
} from '../src/lib/save/SaveParser'
import type { SavedGame } from '../src/lib/save/types'
import { LAYOUT_TEXT, buildGame, stubLookup } from './saveBuilders'

const WRITABLE = [7, 8, 9, 11]

function roundTrip(game: SavedGame): void {
  const bytes = writeSavedGame(game)
  const reread = readSavedGame(bytes, stubLookup)

  expect(reread).toEqual(game)
  expect(writeSavedGame(reread)).toEqual(bytes)
}

describe('parseShipLayout', () => {
  const layout = parseShipLayout(LAYOUT_TEXT, 'test')

  it('reads rooms by id', () => {
    expect(layout.rooms).toEqual([
      { locationX: 1, locationY: 1, squaresH: 2, squaresV: 1 },
      { locationX: 3, locationY: 1, squaresH: 1, squaresV: 2 },
    ])
    expect([layout.offsetX, layout.offsetY]).toEqual([1, 2])
  })

  it('moves doors to vacuum to the end, keeping their order', () => {
    expect(layout.doors.map((d) => [d.wallX, d.wallY, d.vertical])).toEqual([
      [3, 1, 1],
      [1, 0, 0],
      [3, 2, 1],
    ])
  })

  it('handles Windows line endings and a byte order mark', () => {
    const windows = `﻿${LAYOUT_TEXT.replace(/\n/g, '\r\n')}`
    expect(parseShipLayout(windows, 'test')).toEqual(layout)
  })

  it('keeps a repeated door in its first position with the later values', () => {
    const repeated = 'DOOR\n1\n1\n0\n1\n0\nDOOR\n2\n2\n0\n1\n0\nDOOR\n1\n1\n5\n6\n0\n'
    expect(parseShipLayout(repeated, 'test').doors).toEqual([
      { wallX: 1, wallY: 1, vertical: 0, roomIdA: 5, roomIdB: 6 },
      { wallX: 2, wallY: 2, vertical: 0, roomIdA: 0, roomIdB: 1 },
    ])
  })

  it('names the layout when a number is bad', () => {
    expect(() => parseShipLayout('ROOM\nnope\n', 'kestral')).toThrow(/kestral/)
  })

  it('refuses a gap in the room ids', () => {
    expect(() => parseShipLayout('ROOM\n1\n0\n0\n1\n1\n', 'gappy')).toThrow(/no room 0/)
  })
})

describe('saved game round trip', () => {
  for (const fileFormat of WRITABLE) {
    describe(`format ${fileFormat}`, () => {
      it('keeps a save with every optional part', () => {
        roundTrip(buildGame({ fileFormat }))
      })

      it('keeps a save with no nearby ship', () => {
        roundTrip(buildGame({ fileFormat, nearbyShip: false }))
      })

      it('keeps a flagship with artillery in several rooms', () => {
        roundTrip(buildGame({ fileFormat, flagship: true }))
      })

      it('keeps a ship with few systems and no asteroids', () => {
        roundTrip(
          buildGame({
            fileFormat,
            asteroids: false,
            installed: ['shields', 'engines'],
          }),
        )
      })
    })
  }

  it('reads format 2', () => {
    const game = readSavedGame(buildFormat2(), stubLookup)

    expect(game.fileFormat).toBe(2)
    expect(game.dlcEnabled).toBe(false)
    expect(game.randomNative).toBe(true)
    expect(game.playerShip.scrapAmt).toBe(77)
    expect(game.nearbyShip).toBeNull()
    expect(game.rebelFlagship.occupancy).toEqual([4, 5])
  })

  it('refuses to write format 2, as the Java editor does', () => {
    expect(canWriteFormat(2)).toBe(false)
    expect(() => writeSavedGame(buildGame({ fileFormat: 2 }))).toThrow(/format 2/)
  })

  it('keeps strings as UTF-8 only from format 11', () => {
    const named = (fileFormat: number) => {
      const game = buildGame({ fileFormat })
      game.playerShipName = 'Caffè'
      return game
    }

    const utf8 = Buffer.from(writeSavedGame(named(11)))
    const ansi = Buffer.from(writeSavedGame(named(9)))

    expect(utf8.includes(Buffer.from('CaffÃ¨', 'latin1'))).toBe(true)
    expect(ansi.includes(Buffer.from('Caffè', 'latin1'))).toBe(true)
    expect(readSavedGame(ansi, stubLookup).playerShipName).toBe('Caffè')
    expect(readSavedGame(utf8, stubLookup).playerShipName).toBe('Caffè')
  })

  it('keeps square ids in rows, though the file holds them in columns', () => {
    const big = { ...stubLookup }
    big.getShipLayout = () => ({
      offsetX: 0,
      offsetY: 0,
      rooms: [
        { locationX: 0, locationY: 0, squaresH: 2, squaresV: 2 },
        { locationX: 2, locationY: 0, squaresH: 1, squaresV: 1 },
      ],
      doors: [],
    })

    const game = buildGame({ fileFormat: 11, nearbyShip: false })
    const ship = game.playerShip
    ship.doors = []
    ship.rooms = [
      {
        ...ship.rooms[0],
        squaresH: 2,
        squaresV: 2,
        squares: [10, 20, 30, 40].map((fireHealth) => ({
          fireHealth,
          ignitionProgress: 0,
          extinguishmentProgress: 0,
        })),
      },
      { ...ship.rooms[1], squaresH: 1, squaresV: 1, squares: [ship.rooms[1].squares[0]] },
    ]

    const bytes = writeSavedGame(game)
    const reread = readSavedGame(bytes, big)
    expect(reread.playerShip.rooms[0].squares.map((s) => s.fireHealth)).toEqual([
      10, 20, 30, 40,
    ])

    // In the file, squares 0 and 2 (the left column) come first.
    const square = (fireHealth: number) => [fireHealth, 0, 0]
    const columns = new Int32Array([
      ...square(10),
      ...square(30),
      ...square(20),
      ...square(40),
    ])
    expect(Buffer.from(bytes).includes(Buffer.from(columns.buffer))).toBe(true)
  })
})

describe('reading bad files', () => {
  it('points out a file that is not a saved game', () => {
    const writer = new BinaryWriter()
    writer.writeInt(4)
    expect(() => readSavedGame(writer.toBytes(), stubLookup)).toThrow(
      /profile rather than a saved game/,
    )
  })

  it('names a ship the game data does not know', () => {
    const game = buildGame({ fileFormat: 11 })
    game.playerShip.blueprintId = 'MODDED_SHIP'
    expect(() => readSavedGame(writeSavedGame(game), stubLookup)).toThrow(/MODDED_SHIP/)
  })

  it('names a drone the game data does not know', () => {
    const game = buildGame({ fileFormat: 11 })
    game.playerShip.drones[0].droneId = 'MODDED_DRONE'
    expect(() => readSavedGame(writeSavedGame(game), stubLookup)).toThrow(/MODDED_DRONE/)
  })

  it('stops at a truncated file', () => {
    const bytes = writeSavedGame(buildGame({ fileFormat: 11 }))
    expect(() => readSavedGame(bytes.subarray(0, 500), stubLookup)).toThrow()
  })

  it('drops trailing bytes, so the rewrite comes out shorter', () => {
    const bytes = writeSavedGame(buildGame({ fileFormat: 11 }))
    const padded = new Uint8Array(bytes.length + 8)
    padded.set(bytes)

    expect(writeSavedGame(readSavedGame(padded, stubLookup)).length).toBe(bytes.length)
  })
})

describe('writing states that lost a record', () => {
  it('fails rather than shifting the file', () => {
    const game = buildGame({ fileFormat: 11 })
    game.playerShip.mind = null
    expect(() => writeSavedGame(game)).toThrow(/mind control/)
  })
})

/** Format 2 has no writer, so this assembles the file by hand from Java's reader. */
function buildFormat2(): Uint8Array {
  const w = new BinaryWriter()
  const ints = (...values: number[]) => values.forEach((v) => w.writeInt(v))
  const strings = (...values: string[]) => values.forEach((s) => w.writeString(s))

  ints(2) // Format.
  ints(1) // Difficulty.
  ints(1, 2, 3, 4) // Session totals.
  strings('The Ship', 'SHIP')
  ints(3) // Redundant sector number.
  ints(0) // Beta.
  ints(0) // State vars.

  strings('SHIP', 'The Ship', 'kestral')
  ints(0) // Starting crew.
  ints(30, 10, 5, 8, 77) // Hull, fuel, drone parts, missiles, scrap.
  ints(0) // Crew.
  ints(8) // Reserve power.
  ints(...new Array(12).fill(0)) // Systems, all uninstalled.
  for (const squares of [2, 2]) {
    ints(100)
    for (let i = 0; i < squares; i++) ints(0, 0, 0)
  }
  ints(0) // Breaches.
  for (let i = 0; i < 3; i++) ints(0, 0) // Doors.
  ints(1) // Weapons.
  w.writeString('LASER')
  ints(1, 12)
  ints(0) // Drones.
  ints(0) // Augments.

  ints(0) // Cargo.
  ints(1, 2, 3, 4, 5) // Seeds and pursuit.
  ints(0, 0, 0, 0) // Hazards and flagship.
  ints(0) // Sector visitation.
  ints(2) // Sector number.
  ints(0) // Hidden crystal worlds.
  ints(0) // Beacons.
  ints(0) // Quest events.
  ints(0) // Distant quest events.
  ints(0) // Current beacon.
  ints(0) // No nearby ship.
  ints(1) // Flagship pending stage.
  ints(2, 4, 5) // Flagship occupancy.

  return w.toBytes()
}
