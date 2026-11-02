import { describe, expect, it } from 'vitest'

import { readSavedGame, writeSavedGame } from '../src/lib/save/SaveParser'
import {
  addDrone,
  addWeapon,
  findFreeSquare,
  newCrew,
  removeCrew,
  removeDrone,
  removeWeapon,
  replaceDrone,
  setSystemCapacity,
} from '../src/lib/save/mutations'
import type { SavedGame, ShipState, SystemType } from '../src/lib/save/types'
import { buildGame, stubLookup } from './saveBuilders'

const FORMATS = [7, 8, 9, 11]

const systemIndex = (ship: ShipState, type: SystemType) =>
  ship.systems.findIndex((s) => s.type === type)

/**
 * The real test of an edit: the file it makes must read back as what was
 * written, with nothing shifted, for every field.
 */
function expectParsable(game: SavedGame): SavedGame {
  const bytes = writeSavedGame(game)
  const reread = readSavedGame(bytes, stubLookup)

  expect(reread).toEqual(game)
  return reread
}

function edited(game: SavedGame, edit: (ship: ShipState) => ShipState): SavedGame {
  return { ...game, playerShip: edit(game.playerShip) }
}

describe.each(FORMATS)('structural edits in format %i', (fileFormat) => {
  const noOptional = () =>
    buildGame({ fileFormat, installed: ['shields'], nearbyShip: false })
  const everything = () => buildGame({ fileFormat, nearbyShip: false })

  const OPTIONAL: SystemType[] = [
    'clonebay',
    'battery',
    'cloaking',
    'hacking',
    'mind',
    'weapons',
    'artillery',
    'teleporter',
  ]

  it.each(OPTIONAL)('installs %s', (type) => {
    const game = edited(noOptional(), (ship) =>
      setSystemCapacity(ship, systemIndex(ship, type), 2, fileFormat),
    )

    const reread = expectParsable(game)
    expect(reread.playerShip.systems[systemIndex(reread.playerShip, type)].capacity).toBe(2)
  })

  it.each(OPTIONAL)('removes %s', (type) => {
    const game = edited(everything(), (ship) =>
      setSystemCapacity(ship, systemIndex(ship, type), 0, fileFormat),
    )

    const reread = expectParsable(game)
    expect(reread.playerShip.systems[systemIndex(reread.playerShip, type)].capacity).toBe(0)
  })

  it('caps power when a level drops', () => {
    const game = everything()
    const index = systemIndex(game.playerShip, 'shields')
    game.playerShip.systems[index].power = 5

    const ship = setSystemCapacity(game.playerShip, index, 2, fileFormat)
    expect(ship.systems[index].power).toBe(2)
    expectParsable({ ...game, playerShip: ship })
  })

  it('does not disturb a level change on an installed system', () => {
    const game = everything()
    const index = systemIndex(game.playerShip, 'mind')

    const ship = setSystemCapacity(game.playerShip, index, 4, fileFormat)
    expect(ship.mind).toBe(game.playerShip.mind)
  })

  it('adds a weapon with its module', () => {
    const game = edited(everything(), (ship) => addWeapon(ship, 'NEW', fileFormat))
    expect(expectParsable(game).playerShip.weapons.at(-1)?.weaponId).toBe('NEW')
  })

  it('adds a weapon with no module when there is no weapons system', () => {
    const game = edited(noOptional(), (ship) => addWeapon(ship, 'NEW', fileFormat))
    expect(game.playerShip.weapons.at(-1)?.module).toBeNull()
    expectParsable(game)
  })

  it('removes a weapon', () => {
    const game = edited(everything(), (ship) => removeWeapon(ship, 0))
    expect(expectParsable(game).playerShip.weapons).toHaveLength(1)
  })

  it.each([
    ['D_BATTLE', 'BATTLE'],
    ['D_REPAIR', 'REPAIR'],
    ['D_COMBAT', 'COMBAT'],
    ['D_BEAM', 'BEAM'],
    ['D_SHIP_REPAIR', 'SHIP_REPAIR'],
    ['D_DEFENSE', 'DEFENSE'],
    ['D_SHIELD', 'SHIELD'],
    ['D_BOARDER', 'BOARDER'],
    ['D_HACKING', 'HACKING'],
  ])('adds a %s drone', (droneId, type) => {
    expectParsable(edited(everything(), (ship) => addDrone(ship, droneId, type)))
  })

  it('swaps a drone for one with a differently shaped pod', () => {
    const game = edited(everything(), (ship) =>
      replaceDrone(ship, 2, 'D_BOARDER', 'BOARDER'),
    )

    const reread = expectParsable(game)
    expect(reread.playerShip.drones[2].extended?.pod?.extended.extra).toBe('BOARDER')
  })

  it('swaps a pod drone for a podless one', () => {
    const game = edited(everything(), (ship) =>
      replaceDrone(ship, 2, 'D_BATTLE', 'BATTLE'),
    )
    expect(expectParsable(game).playerShip.drones[2].extended?.pod).toBeNull()
  })

  it('removes a drone', () => {
    const game = edited(everything(), (ship) => removeDrone(ship, 0))
    expect(expectParsable(game).playerShip.drones).toHaveLength(8)
  })

  it('refuses a drone of an unknown type', () => {
    expect(() => addDrone(everything().playerShip, 'X', 'WARP')).toThrow(/WARP/)
  })

  it.each(['human', 'crystal'])('adds %s crew', (race) => {
    const game = everything()
    const crew = newCrew(race, { roomId: 1, roomSquare: 1, spriteX: 5, spriteY: 6 })
    game.playerShip.crew = [...game.playerShip.crew, crew]

    const reread = expectParsable(game)
    expect(reread.playerShip.crew.at(-1)?.health).toBe(race === 'crystal' ? 120 : 100)
  })

  it('removes crew', () => {
    const game = edited(everything(), (ship) => removeCrew(ship, 1))
    expect(expectParsable(game).playerShip.crew).toHaveLength(1)
  })

  it('reads crystal fields only for the crew race that has them', () => {
    const game = everything()
    game.playerShip.crew[0] = {
      ...game.playerShip.crew[0],
      race: 'crystal',
      lockdownRechargeTicks: 1,
      lockdownRechargeTicksGoal: 2,
      unknownOmega: 3,
    }
    game.playerShip.crew[1] = {
      ...game.playerShip.crew[1],
      race: 'human',
      lockdownRechargeTicks: 0,
      lockdownRechargeTicksGoal: 0,
      unknownOmega: 0,
    }

    expectParsable(game)
  })
})

describe('artillery in several rooms', () => {
  const FLAGSHIP = 11

  const flagship = () => buildGame({ fileFormat: FLAGSHIP, flagship: true })
  const records = (ship: ShipState) =>
    ship.systems.flatMap((s, i) => (s.type === 'artillery' ? [i] : []))

  it('fills the gap between two installed rooms', () => {
    const game = flagship()
    const ship = game.nearbyShip as ShipState
    const [, middle] = records(ship)

    const nearbyShip = setSystemCapacity(ship, middle, 2, FLAGSHIP)
    expect(nearbyShip.artillery).toHaveLength(3)
    expect(nearbyShip.artillery[0]).toBe(ship.artillery[0])
    expect(nearbyShip.artillery[2]).toBe(ship.artillery[1])

    expectParsable({ ...game, nearbyShip })
  })

  it('removes one room without touching the others', () => {
    const game = flagship()
    const ship = game.nearbyShip as ShipState
    const [first] = records(ship)

    const nearbyShip = setSystemCapacity(ship, first, 0, FLAGSHIP)
    expect(nearbyShip.artillery).toEqual([ship.artillery[1]])

    expectParsable({ ...game, nearbyShip })
  })
})

describe('findFreeSquare', () => {
  const layout = stubLookup.getShipLayout('test')!

  const shipWith = (taken: Array<[number, number]>): ShipState => {
    const ship = buildGame({ fileFormat: 11 }).playerShip
    ship.crew = taken.map(([roomId, roomSquare]) => ({
      ...ship.crew[0],
      roomId,
      roomSquare,
    }))
    return ship
  }

  it('centres the crew member on the square, with the layout offset', () => {
    expect(findFreeSquare(shipWith([]), layout, [])).toEqual({
      roomId: 0,
      roomSquare: 0,
      spriteX: (1 + 1) * 35 + 17,
      spriteY: (2 + 1) * 35 + 17,
    })
  })

  it('counts squares across rows', () => {
    expect(findFreeSquare(shipWith([[0, 0], [0, 1], [1, 0]]), layout, [])).toEqual({
      roomId: 1,
      roomSquare: 1,
      spriteX: (1 + 3) * 35 + 17,
      spriteY: (2 + 1 + 1) * 35 + 17,
    })
  })

  it('skips rooms it is told to avoid', () => {
    expect(findFreeSquare(shipWith([]), layout, [0])?.roomId).toBe(1)
  })

  it('reports a full ship', () => {
    const full = shipWith([[0, 0], [0, 1], [1, 0], [1, 1]])
    expect(findFreeSquare(full, layout, [])).toBeNull()
  })
})
