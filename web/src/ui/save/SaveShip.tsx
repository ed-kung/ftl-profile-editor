import { useId, useState } from 'react'

import type { GameData } from '../../lib/data/GameData'
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
} from '../../lib/save/mutations'
import {
  CREW_RACES,
  type CrewState,
  type SavedGame,
  type ShipState,
  type SystemState,
} from '../../lib/save/types'
import { toInt } from '../ScoreEditor'
import { FieldGrid, IdSelect, ValueInput, type FieldRow } from './fields'

/**
 * A ship's supplies, crew, systems and equipment, as forms.
 *
 * Covers the parts of net.blerf.ftl.ui.SavedGameFloorplanPanel that don't need
 * a drawn ship. Anything that changes the file's structure goes through
 * lib/save/mutations.ts.
 */

const SUPPLY_ROWS: ReadonlyArray<FieldRow<ShipState>> = [
  ['hullAmt', 'Hull'],
  ['fuelAmt', 'Fuel'],
  ['dronePartsAmt', 'Drone Parts'],
  ['missilesAmt', 'Missiles'],
  ['scrapAmt', 'Scrap'],
  ['reservePowerCapacity', 'Reserve Power'],
]

const SKILL_ROWS: ReadonlyArray<FieldRow<CrewState>> = [
  ['pilotSkill', 'Pilot'],
  ['engineSkill', 'Engine'],
  ['shieldSkill', 'Shield'],
  ['weaponSkill', 'Weapon'],
  ['repairSkill', 'Repair'],
  ['combatSkill', 'Combat'],
]

const RECORD_ROWS: ReadonlyArray<FieldRow<CrewState>> = [
  ['repairs', 'Repairs'],
  ['combatKills', 'Combat Kills'],
  ['pilotedEvasions', 'Piloted Evasions'],
  ['jumpsSurvived', 'Jumps Survived'],
  ['skillMasteriesEarned', 'Masteries Earned'],
]

const MASTERY_ROWS: ReadonlyArray<FieldRow<CrewState>> = [
  ['pilotMasteryOne', 'Pilot 1'],
  ['pilotMasteryTwo', 'Pilot 2'],
  ['engineMasteryOne', 'Engine 1'],
  ['engineMasteryTwo', 'Engine 2'],
  ['shieldMasteryOne', 'Shield 1'],
  ['shieldMasteryTwo', 'Shield 2'],
  ['weaponMasteryOne', 'Weapon 1'],
  ['weaponMasteryTwo', 'Weapon 2'],
  ['repairMasteryOne', 'Repair 1'],
  ['repairMasteryTwo', 'Repair 2'],
  ['combatMasteryOne', 'Combat 1'],
  ['combatMasteryTwo', 'Combat 2'],
]

interface Props {
  data: GameData
  game: SavedGame
  onChange: (game: SavedGame) => void
}

export function SaveShip({ data, game, onChange }: Props) {
  const [which, setWhich] = useState<'player' | 'nearby'>('player')

  const showNearby = which === 'nearby' && game.nearbyShip !== null
  const ship = showNearby && game.nearbyShip ? game.nearbyShip : game.playerShip

  const setShip = (next: ShipState) => {
    if (showNearby) {
      onChange({ ...game, nearbyShip: next })
    } else {
      // The file repeats the player's ship name near its start.
      onChange({ ...game, playerShip: next, playerShipName: next.name })
    }
  }

  return (
    <>
      {game.nearbyShip && (
        <div className="tabs" role="tablist" aria-label="Which ship">
          <button
            type="button"
            role="tab"
            aria-selected={!showNearby}
            onClick={() => setWhich('player')}
          >
            Player Ship
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showNearby}
            onClick={() => setWhich('nearby')}
          >
            Nearby Ship
          </button>
        </div>
      )}

      <ShipForm
        data={data}
        ship={ship}
        fileFormat={game.fileFormat}
        onChange={setShip}
      />
    </>
  )
}

interface ShipFormProps {
  data: GameData
  ship: ShipState
  fileFormat: number
  onChange: (ship: ShipState) => void
}

function ShipForm({ data, ship, fileFormat, onChange }: ShipFormProps) {
  return (
    <>
      <div className="two-column">
        <section className="panel">
          <h2>Ship</h2>
          <p className="panel-note">
            Blueprint <code>{ship.blueprintId}</code>
          </p>
          <div className="field-grid">
            <label htmlFor="save-ship-name">Name</label>
            <div>
              <input
                id="save-ship-name"
                type="text"
                value={ship.name}
                onChange={(e) => onChange({ ...ship, name: e.target.value })}
              />
            </div>
          </div>
          <div className="field-gap" />
          <FieldGrid value={ship} rows={SUPPLY_ROWS} onChange={onChange} />
        </section>

        <Augments data={data} ship={ship} onChange={onChange} />
      </div>

      <Systems data={data} ship={ship} fileFormat={fileFormat} onChange={onChange} />
      <Crew data={data} ship={ship} fileFormat={fileFormat} onChange={onChange} />

      <div className="two-column">
        <Weapons data={data} ship={ship} fileFormat={fileFormat} onChange={onChange} />
        <Drones data={data} ship={ship} onChange={onChange} />
      </div>
    </>
  )
}

interface SectionProps {
  data: GameData
  ship: ShipState
  onChange: (ship: ShipState) => void
}

function Systems({
  data,
  ship,
  fileFormat,
  onChange,
}: SectionProps & { fileFormat: number }) {
  const rooms = data.getShip(ship.blueprintId)?.systemRooms ?? {}

  const setSystem = (index: number, fields: Partial<SystemState>) =>
    onChange({
      ...ship,
      systems: ship.systems.map((s, i) => (i === index ? { ...s, ...fields } : s)),
    })

  return (
    <section className="panel">
      <h2>Systems</h2>
      <p className="panel-note">
        A level of 0 removes the system. Only systems this ship has a room for
        can be installed.
      </p>
      <table className="records">
        <thead>
          <tr>
            <th scope="col">System</th>
            <th scope="col">Level</th>
            <th scope="col">Power</th>
            <th scope="col">Damaged Bars</th>
            <th scope="col">Ionized Bars</th>
          </tr>
        </thead>
        <tbody>
          {ship.systems.map((system, i) => {
            const title = data.getSystem(system.type)?.title ?? system.type
            const installed = system.capacity > 0
            const hasRoom = installed || (rooms[system.type]?.length ?? 0) > 0

            return (
              <tr key={i}>
                <th scope="row">{title}</th>
                <td>
                  <input
                    type="number"
                    min={0}
                    aria-label={`${title} level`}
                    disabled={!hasRoom}
                    value={system.capacity}
                    onChange={(e) =>
                      onChange(
                        setSystemCapacity(
                          ship,
                          i,
                          Math.max(0, toInt(e.target.value)),
                          fileFormat,
                        ),
                      )
                    }
                  />
                </td>
                {installed ? (
                  <>
                    <td>
                      <input
                        type="number"
                        min={0}
                        aria-label={`${title} power`}
                        value={system.power}
                        onChange={(e) =>
                          setSystem(i, { power: toInt(e.target.value) })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        aria-label={`${title} damaged bars`}
                        value={system.damagedBars}
                        onChange={(e) =>
                          setSystem(i, { damagedBars: toInt(e.target.value) })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        aria-label={`${title} ionized bars`}
                        value={system.ionizedBars}
                        onChange={(e) =>
                          setSystem(i, { ionizedBars: toInt(e.target.value) })
                        }
                      />
                    </td>
                  </>
                ) : (
                  <td colSpan={3} className="dim-cell">
                    {hasRoom ? 'Not installed' : 'No room on this ship'}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function Crew({
  data,
  ship,
  fileFormat,
  onChange,
}: SectionProps & { fileFormat: number }) {
  const [error, setError] = useState<string | null>(null)

  const setCrew = (index: number, crew: CrewState) =>
    onChange({
      ...ship,
      crew: ship.crew.map((c, i) => (i === index ? crew : c)),
    })

  const add = () => {
    const blueprint = data.getShip(ship.blueprintId)
    const layout = blueprint?.layoutId
      ? data.getShipLayout(blueprint.layoutId)
      : undefined

    // Part of these rooms is taken up by the machine itself.
    const rooms = blueprint?.systemRooms ?? {}
    const avoid = [...(rooms.medbay ?? []), ...(rooms.clonebay ?? [])]

    const placement = layout ? findFreeSquare(ship, layout, avoid) : null
    if (!placement) {
      setError('Every floor square on this ship is already taken.')
      return
    }

    setError(null)
    onChange({ ...ship, crew: [...ship.crew, newCrew('human', placement)] })
  }

  return (
    <section className="panel">
      <h2>Crew</h2>
      <p className="panel-note">Skill values are experience points, not levels.</p>

      {ship.crew.map((crew, i) => (
        <CrewMember
          key={i}
          crew={crew}
          fileFormat={fileFormat}
          onChange={(next) => setCrew(i, next)}
          onRemove={() => onChange(removeCrew(ship, i))}
        />
      ))}

      {error && <p className="panel-note">{error}</p>}
      <div className="add-row">
        <button type="button" onClick={add}>
          Add Crew
        </button>
      </div>
    </section>
  )
}

interface CrewMemberProps {
  crew: CrewState
  fileFormat: number
  onChange: (crew: CrewState) => void
  onRemove: () => void
}

function CrewMember({ crew, fileFormat, onChange, onRemove }: CrewMemberProps) {
  const nameId = useId()

  const races = Object.keys(CREW_RACES)
  if (!races.includes(crew.race)) races.push(crew.race)

  const maxHealth = CREW_RACES[crew.race]?.maxHealth

  return (
    <details className="crew-member">
      <summary>
        {crew.name || '(no name)'} <span className="dim-cell">— {crew.race}</span>
      </summary>

      <div className="crew-grid">
        <div>
          <div className="field-grid">
            <label htmlFor={nameId}>Name</label>
            <div>
              <ValueInput
                id={nameId}
                value={crew.name}
                onChange={(name) => onChange({ ...crew, name: name as string })}
              />
            </div>

            <span className="field-label">Race</span>
            <div>
              <select
                aria-label={`${crew.name} race`}
                value={crew.race}
                onChange={(e) => {
                  // Crystal crew have fields no other race does, which the
                  // parser reads and writes by race, so this needs no clean-up.
                  onChange({ ...crew, race: e.target.value })
                }}
              >
                {races.map((race) => (
                  <option key={race}>{race}</option>
                ))}
              </select>
            </div>

            <span className="field-label">
              Health{maxHealth ? ` (of ${maxHealth})` : ''}
            </span>
            <div>
              <ValueInput
                label={`${crew.name} health`}
                value={crew.health}
                onChange={(health) => onChange({ ...crew, health: health as number })}
              />
            </div>

            <span className="field-label">Male</span>
            <div>
              <ValueInput
                label={`${crew.name} male`}
                value={crew.male}
                onChange={(male) => onChange({ ...crew, male: male as boolean })}
              />
            </div>
          </div>
          <div className="field-gap" />
          <FieldGrid value={crew} rows={RECORD_ROWS} onChange={onChange} />
        </div>

        <FieldGrid value={crew} rows={SKILL_ROWS} onChange={onChange} />

        {fileFormat >= 8 && (
          <FieldGrid value={crew} rows={MASTERY_ROWS} onChange={onChange} />
        )}
      </div>

      <button type="button" onClick={onRemove}>
        Remove {crew.name || 'crew member'}
      </button>
    </details>
  )
}

function Weapons({
  data,
  ship,
  fileFormat,
  onChange,
}: SectionProps & { fileFormat: number }) {
  const options = data.getWeapons()

  return (
    <section className="panel">
      <h2>Weapons</h2>
      {ship.weapons.length === 0 && <p className="panel-note">None.</p>}

      {ship.weapons.map((weapon, i) => (
        <div className="item-row" key={i}>
          <IdSelect
            label={`Weapon ${i + 1}`}
            value={weapon.weaponId}
            options={options}
            onChange={(weaponId) =>
              onChange({
                ...ship,
                weapons: ship.weapons.map((w, j) =>
                  j === i ? { ...w, weaponId } : w,
                ),
              })
            }
          />
          <label className="check-label">
            <input
              type="checkbox"
              checked={weapon.armed}
              onChange={(e) =>
                onChange({
                  ...ship,
                  weapons: ship.weapons.map((w, j) =>
                    j === i ? { ...w, armed: e.target.checked } : w,
                  ),
                })
              }
            />{' '}
            Armed
          </label>
          <button type="button" onClick={() => onChange(removeWeapon(ship, i))}>
            Remove
          </button>
        </div>
      ))}

      {options.length > 0 && (
        <div className="add-row">
          <button
            type="button"
            onClick={() => onChange(addWeapon(ship, options[0].id, fileFormat))}
          >
            Add Weapon
          </button>
        </div>
      )}
    </section>
  )
}

function Drones({ data, ship, onChange }: SectionProps) {
  const options = data.getDrones()

  return (
    <section className="panel">
      <h2>Drones</h2>
      <p className="panel-note">Changing a drone recalls it, undeployed.</p>
      {ship.drones.length === 0 && <p className="panel-note">None.</p>}

      {ship.drones.map((drone, i) => (
        <div className="item-row" key={i}>
          <IdSelect
            label={`Drone ${i + 1}`}
            value={drone.droneId}
            options={options}
            onChange={(droneId) =>
              onChange(replaceDrone(ship, i, droneId, data.getDrone(droneId)?.type))
            }
          />
          <button type="button" onClick={() => onChange(removeDrone(ship, i))}>
            Remove
          </button>
        </div>
      ))}

      {options.length > 0 && (
        <div className="add-row">
          <button
            type="button"
            onClick={() => onChange(addDrone(ship, options[0].id, options[0].type))}
          >
            Add Drone
          </button>
        </div>
      )}
    </section>
  )
}

function Augments({ data, ship, onChange }: SectionProps) {
  const options = data.getAugments()

  const setAugments = (augmentIds: string[]) => onChange({ ...ship, augmentIds })

  return (
    <section className="panel">
      <h2>Augments</h2>
      {ship.augmentIds.length === 0 && <p className="panel-note">None.</p>}

      {ship.augmentIds.map((augmentId, i) => (
        <div className="item-row" key={i}>
          <IdSelect
            label={`Augment ${i + 1}`}
            value={augmentId}
            options={options}
            onChange={(id) =>
              setAugments(ship.augmentIds.map((a, j) => (j === i ? id : a)))
            }
          />
          <button
            type="button"
            onClick={() => setAugments(ship.augmentIds.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}

      {options.length > 0 && (
        <div className="add-row">
          <button
            type="button"
            onClick={() => setAugments([...ship.augmentIds, options[0].id])}
          >
            Add Augment
          </button>
        </div>
      )}
    </section>
  )
}
