import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GameData } from '../src/lib/data/GameData'
import { DATA_PACK_SCHEMA } from '../src/lib/datapack'
import { describeFirstDifference } from '../src/lib/io/compareBytes'
import { readSavedGame, writeSavedGame } from '../src/lib/save/SaveParser'
import { dumpSavedGame } from '../src/lib/save/dump'
import { SaveEditor } from '../src/ui/SaveEditor'
import { LAYOUT_TEXT, buildGame } from './saveBuilders'

/**
 * Drives the real editor over a small game-data pack: open a file, edit it
 * through the forms, and check the bytes handed to the browser.
 */

const BLUEPRINTS = `<?xml version="1.0"?><root>
  <shipBlueprint name="SHIP" layout="test" img="test">
    <class>Test Cruiser</class>
    <systemList>
      <shields room="0" power="1"/>
      <engines room="1" power="1"/>
      <medbay room="0" power="1"/>
      <artillery room="0" power="1"/>
    </systemList>
  </shipBlueprint>
  <shipBlueprint name="FLAGSHIP" layout="test" img="test"><systemList/></shipBlueprint>
  <weaponBlueprint name="W1"><title>Laser</title></weaponBlueprint>
  <weaponBlueprint name="W2"><title>Missile</title></weaponBlueprint>
  <droneBlueprint name="D_COMBAT"><type>COMBAT</type><title>Combat</title></droneBlueprint>
  <droneBlueprint name="D_BEAM"><type>BEAM</type></droneBlueprint>
  <droneBlueprint name="D_SHIP_REPAIR"><type>SHIP_REPAIR</type></droneBlueprint>
  <droneBlueprint name="D_DEFENSE"><type>DEFENSE</type></droneBlueprint>
  <droneBlueprint name="D_SHIELD"><type>SHIELD</type></droneBlueprint>
  <droneBlueprint name="D_BOARDER"><type>BOARDER</type></droneBlueprint>
  <droneBlueprint name="D_HACKING"><type>HACKING</type></droneBlueprint>
  <droneBlueprint name="D_BATTLE"><type>BATTLE</type></droneBlueprint>
  <droneBlueprint name="D_REPAIR"><type>REPAIR</type></droneBlueprint>
  <augBlueprint name="AUG_1"><title>An augment</title></augBlueprint>
  <systemBlueprint name="shields"><title>Shields</title><maxPower>8</maxPower></systemBlueprint>
</root>`

const SECTORS = `<?xml version="1.0"?><root>
  <sectorType name="CIVILIAN"><sector>CIV</sector></sectorType>
  <sectorType name="NEBULA"><sector>NEB</sector></sectorType>
  <sectorType name="HOSTILE"><sector>HOS</sector></sectorType>
  <sectorDescription name="CIV" minSector="0" unique="false"><nameList><name>Civ</name></nameList></sectorDescription>
  <sectorDescription name="NEB" minSector="0" unique="false"><nameList><name>Neb</name></nameList></sectorDescription>
  <sectorDescription name="HOS" minSector="0" unique="false"><nameList><name>Hos</name></nameList></sectorDescription>
</root>`

const ACHIEVEMENTS = '<?xml version="1.0"?><root></root>'

function gameData(): GameData {
  return GameData.fromPack({
    schemaVersion: DATA_PACK_SCHEMA,
    source: { fileName: 'ftl.dat', fileSize: 0, lastModified: 0, extractedAt: 0 },
    xml: {
      'achievements.xml': ACHIEVEMENTS,
      'blueprints.xml': BLUEPRINTS,
      'sector_data.xml': SECTORS,
    },
    layouts: { test: LAYOUT_TEXT },
    icons: {},
  })
}

let container: HTMLDivElement
let root: Root
let downloaded: Uint8Array[]

async function setValue(input: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto =
    input instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', {
      bubbles: true,
    }))
  })
}

const button = (text: string | RegExp): HTMLButtonElement => {
  const found = Array.from(container.querySelectorAll('button')).find((b) => {
    const name = b.getAttribute('aria-label') ?? b.textContent ?? ''
    return typeof text === 'string' ? name === text : text.test(name)
  })
  if (!found) throw new Error(`No button "${text}" in: ${container.textContent}`)
  return found
}

const click = (text: string | RegExp) =>
  act(async () => {
    button(text).click()
  })

const inputLabelled = (label: string): HTMLInputElement => {
  const byAria = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)
  if (byAria) return byAria

  const labelEl = Array.from(container.querySelectorAll('label')).find(
    (l) => l.textContent === label,
  )
  const input = labelEl && document.getElementById(labelEl.htmlFor)
  if (!input) throw new Error(`No input "${label}"`)
  return input as HTMLInputElement
}

async function openBytes(bytes: Uint8Array, name = 'continue.sav') {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('No file input')

  const file = new File([bytes.slice()], name)
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => bytes.slice().buffer,
  })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })

  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

async function mount() {
  await act(async () => {
    root.render(
      <SaveEditor
        data={gameData()}
        cachePersisted
        modeSwitch={null}
        onReplaceGameData={() => {}}
        onDirtyChange={() => {}}
      />,
    )
  })
}

const fixture = () => buildGame({ fileFormat: 11, nearbyShip: false, installed: ['shields'] })

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)

  downloaded = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  // jsdom has no object URLs, so these are defined rather than spied on.
  URL.revokeObjectURL = () => {}
  URL.createObjectURL = (blob) => {
    const reader = new FileReader()
    reader.onload = () =>
      downloaded.push(new Uint8Array(reader.result as ArrayBuffer))
    reader.readAsArrayBuffer(blob as Blob)
    return 'blob:test'
  }
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

async function savedGame() {
  await click('Save')
  await vi.waitFor(() => expect(downloaded.length).toBeGreaterThan(0))
  return readSavedGame(downloaded[0], gameData())
}

describe('the saved game editor', () => {
  it('asks for a file first', async () => {
    await mount()
    expect(container.textContent).toContain('continue.sav')
  })

  it('opens a save, and saving unchanged gives back the same bytes', async () => {
    const bytes = writeSavedGame(fixture())

    await mount()
    await openBytes(bytes)
    await click('Save')

    await vi.waitFor(() => expect(downloaded).toHaveLength(1))
    expect(describeFirstDifference(bytes, downloaded[0])).toBeNull()
  })

  it('blocks saving when a file does not rewrite exactly', async () => {
    const bytes = writeSavedGame(fixture())
    const padded = new Uint8Array(bytes.length + 4)
    padded.set(bytes)

    await mount()
    await openBytes(padded)

    expect(container.textContent).toContain('did not survive a test rewrite')
    expect(button('Save').disabled).toBe(true)
  })

  it('explains a profile opened by mistake', async () => {
    await mount()
    await openBytes(new Uint8Array(new Int32Array([9, 2, 0]).buffer), 'ae_prof.sav')

    expect(container.textContent).toContain('open it under Profile')
  })

  it('edits session values', async () => {
    await mount()
    await openBytes(writeSavedGame(fixture()))

    await setValue(inputLabelled('Total Ships Defeated'), '321')
    await setValue(inputLabelled('Difficulty'), 'EASY')

    const game = await savedGame()
    expect(game.totalShipsDefeated).toBe(321)
    expect(game.difficulty).toBe('EASY')
  })

  it('edits cargo, closing up blank slots', async () => {
    await mount()
    await openBytes(writeSavedGame(fixture()))

    await setValue(inputLabelled('Slot 1'), '')
    await setValue(inputLabelled('Slot 3'), 'W1')

    expect((await savedGame()).cargoIds).toEqual(['CARGO_B', 'W1'])
  })

  it('adds and removes state vars', async () => {
    await mount()
    await openBytes(writeSavedGame(fixture()))
    await click('State Vars')

    await setValue(inputLabelled('New state var name'), 'nebula')
    await click('Add')
    await click('Remove blue_alien')
    await setValue(inputLabelled('nebula'), '9')

    expect((await savedGame()).stateVars).toEqual([
      { id: 'env_danger', value: 3 },
      { id: 'nebula', value: 9 },
    ])
  })

  it('renames the ship in both places the file holds its name', async () => {
    await mount()
    await openBytes(writeSavedGame(fixture()))
    await click('Ship')

    await setValue(inputLabelled('Name'), 'Renamed')
    await setValue(inputLabelled('Scrap'), '5000')

    const game = await savedGame()
    expect(game.playerShipName).toBe('Renamed')
    expect(game.playerShip.name).toBe('Renamed')
    expect(game.playerShip.scrapAmt).toBe(5000)
  })

  it('installs a system the ship has a room for', async () => {
    await mount()
    await openBytes(writeSavedGame(fixture()))
    await click('Ship')

    await setValue(inputLabelled('medbay level'), '2')

    const game = await savedGame()
    expect(game.playerShip.systems.find((s) => s.type === 'medbay')?.capacity).toBe(2)
  })

  it('will not install a system the ship has no room for', async () => {
    await mount()
    await openBytes(writeSavedGame(fixture()))
    await click('Ship')

    expect(inputLabelled('hacking level').disabled).toBe(true)
  })

  it('adds, swaps and removes equipment through a valid file', async () => {
    await mount()
    await openBytes(writeSavedGame(fixture()))
    await click('Ship')

    await click('Add Weapon')
    await click('Add Drone')
    await setValue(inputLabelled('Drone 3'), 'D_BOARDER')
    await click('Add Augment')

    const game = await savedGame()
    expect(game.playerShip.weapons).toHaveLength(3)
    expect(game.playerShip.drones).toHaveLength(10)
    expect(game.playerShip.drones[2].extended?.pod?.extended.extra).toBe('BOARDER')
    expect(game.playerShip.augmentIds).toHaveLength(3)
  })

  it('adds crew on a free square, away from the medbay', async () => {
    const start = fixture()
    start.playerShip.crew = []

    await mount()
    await openBytes(writeSavedGame(start))
    await click('Ship')
    await click('Add Crew')

    const [crew] = (await savedGame()).playerShip.crew
    expect(crew.roomId).toBe(1)
    expect(crew.health).toBe(100)
  })

  it('shows every field in the dump', async () => {
    await mount()
    await openBytes(writeSavedGame(fixture()))
    await click('Dump')

    expect(container.textContent).toContain('scrapAmt')
    expect(container.textContent).toContain('blue_alien')
  })

  it('rolls the route back', async () => {
    const start = fixture()
    start.sectorVisitation = [true, false, true, true, false]
    start.sectorNumber = 2

    await mount()
    await openBytes(writeSavedGame(start))
    await click('Sector Tree')
    await click('Roll Back')

    const game = await savedGame()
    expect(game.sectorVisitation).toEqual([true, false, false, false, false])
    expect(game.sectorNumber).toBe(0)
  })

  it('restores the original tree after a new seed', async () => {
    const start = fixture()
    start.sectorVisitation = [true, false, true]

    await mount()
    await openBytes(writeSavedGame(start))
    await click('Sector Tree')
    await click('Random Seed')
    await click('Restore Original Tree')

    const game = await savedGame()
    expect(game.sectorTreeSeed).toBe(start.sectorTreeSeed)
    expect(game.sectorVisitation).toEqual(start.sectorVisitation)
  })

  it('still restores the original tree after visiting another tab', async () => {
    const start = fixture()
    start.sectorVisitation = [true, false, true]

    await mount()
    await openBytes(writeSavedGame(start))
    await click('Sector Tree')
    await click('Random Seed')
    await click('General')
    await click('Sector Tree')
    await click('Restore Original Tree')

    const game = await savedGame()
    expect(game.sectorTreeSeed).toBe(start.sectorTreeSeed)
    expect(game.sectorVisitation).toEqual(start.sectorVisitation)
  })

  it('treats the last save as the original to restore', async () => {
    await mount()
    await openBytes(writeSavedGame(fixture()))
    await click('Sector Tree')
    await setValue(inputLabelled('Seed'), '1234')
    await click('Apply')
    await click('Save')
    await vi.waitFor(() => expect(downloaded).toHaveLength(1))

    await setValue(inputLabelled('Seed'), '5678')
    await click('Apply')
    await click('Restore Original Tree')

    expect(inputLabelled('Seed').value).toBe('1234')
  })

  it('labels each crew member with their own fields, even on one square', async () => {
    const start = fixture()
    start.playerShip.crew[1] = {
      ...start.playerShip.crew[1],
      roomId: start.playerShip.crew[0].roomId,
      roomSquare: start.playerShip.crew[0].roomSquare,
    }

    await mount()
    await openBytes(writeSavedGame(start))
    await click('Ship')

    const ids = Array.from(container.querySelectorAll('input[id]')).map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('makes a new tree from a new seed, with the route restarted', async () => {
    await mount()
    await openBytes(writeSavedGame(fixture()))
    await click('Sector Tree')
    await setValue(inputLabelled('Seed'), '1234')
    await click('Apply')

    const game = await savedGame()
    expect(game.sectorTreeSeed).toBe(1234)
    expect(game.sectorNumber).toBe(0)
    expect(game.sectorVisitation[0]).toBe(true)
    expect(game.sectorVisitation.filter(Boolean)).toHaveLength(1)
  })

  it('warns when the seed does not fit the route', async () => {
    await mount()
    await openBytes(writeSavedGame(fixture()))
    await click('Sector Tree')
    await setValue(inputLabelled('View'), 'expanded')

    expect(container.textContent).toContain('probably used a different generator')
  })

  it('moves along the route in the expanded view', async () => {
    await mount()
    await openBytes(writeSavedGame(fixture()))
    await click('Sector Tree')
    await setValue(inputLabelled('Seed'), '1234')
    await click('Apply')
    await setValue(inputLabelled('View'), 'expanded')

    const nextDot = container.querySelector<HTMLButtonElement>('.sector-dot.is-next')
    expect(nextDot).not.toBeNull()
    await act(async () => nextDot?.click())

    expect((await savedGame()).sectorNumber).toBe(1)
  })
})

describe('format 2 saves', () => {
  it('can be dumped without game data', () => {
    const text = dumpSavedGame(buildGame({ fileFormat: 2 }), 'continue.sav', 'ftl.dat')
    expect(text).toContain('FTL 1.01')
  })
})
