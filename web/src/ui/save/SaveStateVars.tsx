import { useState } from 'react'

import type { SavedGame, StateVar } from '../../lib/save/types'
import { toInt } from '../ScoreEditor'

/**
 * Running counters that events check against.
 *
 * A port of net.blerf.ftl.ui.SavedGameStateVarsPanel. FTL only stores a var
 * once it has been counted, so the known ones are offered to add.
 */

const KNOWN_VARS: Record<string, string> = {
  blue_alien: 'Blue event choices clicked. (Only ones that require a race.)',
  dead_crew: 'Ships defeated by killing all enemy crew.',
  destroyed_rock: 'Rock ships destroyed, including pirates.',
  env_danger: 'Jumps into beacons with environmental dangers.',
  fired_shot: 'Individual beams/blasts/projectiles fired. (See also: used_missile)',
  higho2: 'Times oxygen exceeded 20%, incremented when arriving at a beacon.',
  killed_crew: 'Enemy crew killed. (And possibly friendly fire?)',
  lost_crew:
    "Crew you've lost: killed, abandoned on nearby ships, taken by events?, but not dismissed. Even if cloned later. (See also: dead_crew)",
  nebula: 'Jumps into nebula beacons.',
  offensive_drone: 'The number of times drones capable of damaging an enemy ship powered up.',
  reactor_upgrade: "Reactor (power bar) upgrades beyond the ship's default levels.",
  store_purchase: "Non-repair purchases, such as crew/items. (Selling isn't counted.)",
  store_repair: 'Store repair button clicks.',
  suffocated_crew: 'Unknown.',
  system_upgrade: "System (and subsystem; not reactor) upgrades beyond the ship's default levels.",
  teleported: 'Teleporter activations, in either direction.',
  used_drone: 'The number of times drone parts were consumed.',
  used_missile: 'Missile/bomb weapon discharges. (See also: fired_shot)',
  weapon_upgrade: "Weapons system upgrades beyond the ship's default levels. (See also: system_upgrade)",
}

interface Props {
  game: SavedGame
  onChange: (game: SavedGame) => void
}

export function SaveStateVars({ game, onChange }: Props) {
  const [newId, setNewId] = useState('')

  const setVars = (stateVars: StateVar[]) => onChange({ ...game, stateVars })

  const id = newId.trim()
  const taken = game.stateVars.some((v) => v.id === id)
  const missing = Object.keys(KNOWN_VARS).filter(
    (known) => !game.stateVars.some((v) => v.id === known),
  )

  return (
    <section className="panel">
      <h2>State Vars</h2>
      <p className="panel-note">
        Counters kept through the run. Some events and quests depend on them.
      </p>

      <table className="records">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Value</th>
            <th scope="col">Meaning</th>
            <th scope="col">
              <span className="visually-hidden">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {game.stateVars.map((stateVar, i) => (
            <tr key={stateVar.id}>
              <th scope="row">
                <code>{stateVar.id}</code>
              </th>
              <td>
                <input
                  type="number"
                  aria-label={stateVar.id}
                  value={stateVar.value}
                  onChange={(e) =>
                    setVars(
                      game.stateVars.map((v, j) =>
                        j === i ? { ...v, value: toInt(e.target.value) } : v,
                      ),
                    )
                  }
                />
              </td>
              <td className="dim-cell">
                {KNOWN_VARS[stateVar.id] ?? 'Not a var this editor knows.'}
              </td>
              <td>
                <button
                  type="button"
                  aria-label={`Remove ${stateVar.id}`}
                  onClick={() => setVars(game.stateVars.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="add-row">
        <input
          type="text"
          list="known-state-vars"
          aria-label="New state var name"
          placeholder="New var name"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
        />
        <datalist id="known-state-vars">
          {missing.map((known) => (
            <option key={known} value={known} />
          ))}
        </datalist>
        <button
          type="button"
          disabled={id === '' || taken}
          onClick={() => {
            setVars([...game.stateVars, { id, value: 0 }])
            setNewId('')
          }}
        >
          Add
        </button>
      </div>
    </section>
  )
}
