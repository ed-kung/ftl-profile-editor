import type { GameData } from '../../lib/data/GameData'
import type { Difficulty } from '../../lib/profile/types'
import {
  DIFFICULTY_FLAGS,
  HAZARD_VULNERABILITIES,
  isAE,
  type AsteroidFieldState,
  type EncounterState,
  type EnvironmentState,
  type HazardVulnerability,
  type NearbyShipAIState,
  type RebelFlagshipState,
  type SavedGame,
} from '../../lib/save/types'
import { FieldGrid, type FieldRow } from './fields'

/**
 * Run-wide settings.
 *
 * A port of net.blerf.ftl.ui.SavedGameGeneralPanel, plus the rebel pursuit
 * values that panel leaves out.
 */

const CARGO_SLOTS = 4

const SESSION_ROWS: ReadonlyArray<FieldRow<SavedGame>> = [
  ['totalShipsDefeated', 'Total Ships Defeated'],
  ['totalBeaconsExplored', 'Total Beacons Explored'],
  ['totalScrapCollected', 'Total Scrap Collected'],
  ['totalCrewHired', 'Total Crew Hired'],
]

const PURSUIT_ROWS: ReadonlyArray<FieldRow<SavedGame>> = [
  ['rebelFleetOffset', 'Rebel Fleet Offset'],
  ['rebelFleetFudge', 'Rebel Fleet Fudge'],
  ['rebelPursuitMod', 'Rebel Pursuit Mod'],
]

const FLAGSHIP_ROWS: ReadonlyArray<FieldRow<SavedGame>> = [
  ['rebelFlagshipVisible', 'Flagship Visible'],
  ['rebelFlagshipHop', 'Flagship Hop'],
  ['rebelFlagshipMoving', 'Flagship Moving'],
  ['rebelFlagshipRetreating', 'Flagship Retreating'],
  ['rebelFlagshipBaseTurns', 'Flagship Base Turns'],
]

const FLAGSHIP_STATE_ROWS: ReadonlyArray<FieldRow<RebelFlagshipState>> = [
  ['pendingStage', 'Pending Stage'],
]

const SECTOR_ROWS: ReadonlyArray<FieldRow<SavedGame>> = [
  ['sectorIsHiddenCrystalWorlds', 'Hidden Crystal Worlds'],
  ['sectorHazardsVisible', 'Hazards Visible'],
  ['waiting', 'Waiting'],
  ['waitEventSeed', 'Wait Event Seed'],
  ['autofire', 'Autofire'],
]

const ENVIRONMENT_ROWS: ReadonlyArray<FieldRow<EnvironmentState>> = [
  ['redGiantPresent', 'Red Giant'],
  ['pulsarPresent', 'Pulsar'],
  ['pdsPresent', 'PDS'],
  ['solarFlareFadeTicks', 'Flare Fade Ticks?'],
  ['havocTicks', 'Havoc Ticks?'],
  ['pdsTicks', 'PDS Ticks?'],
]

const ASTEROID_ROWS: ReadonlyArray<FieldRow<AsteroidFieldState>> = [
  ['strayRockTicks', 'Stray Rock Ticks?'],
  ['bgDriftTicks', 'Background Drift Ticks'],
  ['currentTarget', 'Current Target?'],
]

const ASTEROID_UNKNOWN_ROWS: ReadonlyArray<FieldRow<AsteroidFieldState>> = [
  ['unknownAlpha', 'Alpha?'],
  ['unknownGamma', 'Gamma?'],
]

const AI_ROWS: ReadonlyArray<FieldRow<NearbyShipAIState>> = [
  ['surrendered', 'Surrendered'],
  ['escaping', 'Escaping'],
  ['destroyed', 'Destroyed'],
  ['surrenderThreshold', 'Surrender Threshold'],
  ['escapeThreshold', 'Escape Threshold'],
  ['escapeTicks', 'Escape Ticks'],
  ['stalemateTriggered', 'Stalemate Triggered?'],
  ['stalemateTicks', 'Stalemate Ticks?'],
  ['boardingAttempts', 'Boarding Attempts?'],
  ['boardersNeeded', 'Boarders Needed?'],
]

const ENCOUNTER_ROWS: ReadonlyArray<FieldRow<EncounterState>> = [
  ['shipEventSeed', 'Ship Event Seed'],
  ['surrenderEventId', 'Surrender Event'],
  ['escapeEventId', 'Escape Event'],
  ['destroyedEventId', 'Destroyed Event'],
  ['deadCrewEventId', 'Dead Crew Event'],
  ['gotAwayEventId', 'Got Away Event'],
  ['lastEventId', 'Last Event'],
  ['text', 'Text'],
  ['affectedCrewSeed', 'Affected Crew Seed'],
]

const UNKNOWN_ROWS: ReadonlyArray<FieldRow<SavedGame>> = [
  ['unknownBeta', 'Beta?'],
  ['unknownEpsilon', 'Epsilon?'],
  ['unknownMu', 'Mu?'],
  ['unknownNu', 'Nu?'],
  ['unknownXi', 'Xi?'],
]

interface Props {
  data: GameData
  game: SavedGame
  onChange: (game: SavedGame) => void
}

export function SaveGeneral({ data, game, onChange }: Props) {
  const ae = isAE(game.fileFormat)
  const set = (fields: Partial<SavedGame>) => onChange({ ...game, ...fields })

  const difficulties: Difficulty[] = ae
    ? DIFFICULTY_FLAGS
    : DIFFICULTY_FLAGS.filter((d) => d !== 'HARD')

  // Beyond the four slots FTL shows, anything in the file is kept as it is.
  const cargoSlots = Array.from(
    { length: Math.max(CARGO_SLOTS, game.cargoIds.length) },
    (_, i) => game.cargoIds[i] ?? '',
  )

  const setCargo = (slot: number, id: string) => {
    const next = cargoSlots.map((current, i) => (i === slot ? id : current))
    set({ cargoIds: next.filter((cargoId) => cargoId !== '') })
  }

  const unknownRows = UNKNOWN_ROWS.filter(([key]) => game[key] !== null)

  return (
    <>
      <div className="two-column">
        <section className="panel">
          <h2>Session</h2>
          <div className="field-grid">
            <label htmlFor="save-difficulty">Difficulty</label>
            <div>
              <select
                id="save-difficulty"
                value={game.difficulty}
                onChange={(e) => set({ difficulty: e.target.value as Difficulty })}
              >
                {difficulties.map((difficulty) => (
                  <option key={difficulty}>{difficulty}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-gap" />
          <FieldGrid value={game} rows={SESSION_ROWS} onChange={onChange} />
          <p className="panel-note field-gap">
            Advanced Edition content is {game.dlcEnabled ? 'on' : 'off'} for this
            run.
          </p>
        </section>

        <section className="panel">
          <h2>Cargo</h2>
          <p className="panel-note">
            Items held in storage, by id. Leave a slot blank for nothing.
          </p>
          <div className="field-grid">
            {cargoSlots.map((cargoId, i) => (
              <CargoSlot
                key={i}
                slot={i}
                value={cargoId}
                onChange={(id) => setCargo(i, id)}
              />
            ))}
          </div>
          <datalist id="save-cargo-ids">
            {[...data.getWeapons(), ...data.getDrones()].map((item) => (
              <option key={item.id} value={item.id}>
                {item.title ?? item.id}
              </option>
            ))}
          </datalist>
        </section>
      </div>

      <div className="two-column">
        <section className="panel">
          <h2>Rebel Pursuit</h2>
          <FieldGrid value={game} rows={PURSUIT_ROWS} onChange={onChange} />
          {ae && (
            <>
              <div className="field-gap" />
              <FieldGrid value={game} rows={FLAGSHIP_ROWS} onChange={onChange} />
              <div className="field-gap" />
              <FieldGrid
                value={game.rebelFlagship}
                rows={FLAGSHIP_STATE_ROWS}
                onChange={(rebelFlagship) => set({ rebelFlagship })}
              />
            </>
          )}
        </section>

        <section className="panel">
          <h2>Sector</h2>
          <FieldGrid value={game} rows={SECTOR_ROWS} onChange={onChange} />
        </section>
      </div>

      {game.environment && (
        <Environment
          environment={game.environment}
          onChange={(environment) => set({ environment })}
        />
      )}

      {game.nearbyShipAI && (
        <section className="panel">
          <h2>Nearby Ship AI</h2>
          <FieldGrid
            value={game.nearbyShipAI}
            rows={AI_ROWS}
            onChange={(nearbyShipAI) => set({ nearbyShipAI })}
          />
        </section>
      )}

      {game.encounter && (
        <section className="panel">
          <h2>Encounter</h2>
          <FieldGrid
            value={game.encounter}
            rows={ENCOUNTER_ROWS}
            onChange={(encounter) => set({ encounter })}
          />
        </section>
      )}

      {ae && (
        <details className="panel">
          <summary>Fields nobody has identified</summary>
          <p className="panel-note field-gap">
            Kept so they can be written back. Changing them is an experiment.
          </p>
          <FieldGrid value={game} rows={unknownRows} onChange={onChange} />
        </details>
      )}
    </>
  )
}

interface CargoSlotProps {
  slot: number
  value: string
  onChange: (id: string) => void
}

function CargoSlot({ slot, value, onChange }: CargoSlotProps) {
  const id = `save-cargo-${slot}`
  return (
    <>
      <label htmlFor={id}>Slot {slot + 1}</label>
      <div>
        <input
          id={id}
          type="text"
          list="save-cargo-ids"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
        />
      </div>
    </>
  )
}

interface EnvironmentProps {
  environment: EnvironmentState
  onChange: (environment: EnvironmentState) => void
}

function Environment({ environment, onChange }: EnvironmentProps) {
  const { asteroidField } = environment

  return (
    <section className="panel">
      <h2>Environment</h2>
      <p className="panel-note">The hazards at the current beacon.</p>

      <div className="field-grid">
        <label htmlFor="save-vulnerable">Vulnerable Ships</label>
        <div>
          <select
            id="save-vulnerable"
            value={environment.vulnerableShips}
            onChange={(e) =>
              onChange({
                ...environment,
                vulnerableShips: e.target.value as HazardVulnerability,
              })
            }
          >
            {HAZARD_VULNERABILITIES.map((vulnerable) => (
              <option key={vulnerable}>{vulnerable}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field-gap" />
      <FieldGrid value={environment} rows={ENVIRONMENT_ROWS} onChange={onChange} />
      <div className="field-gap" />

      <label className="check-label">
        <input
          type="checkbox"
          checked={asteroidField !== null}
          onChange={(e) =>
            onChange({
              ...environment,
              asteroidField: e.target.checked
                ? {
                    unknownAlpha: 0,
                    strayRockTicks: 0,
                    unknownGamma: 0,
                    bgDriftTicks: 0,
                    currentTarget: 0,
                  }
                : null,
            })
          }
        />{' '}
        Asteroid Field
      </label>

      {asteroidField && (
        <>
          <div className="field-gap" />
          <FieldGrid
            value={asteroidField}
            rows={[...ASTEROID_ROWS, ...ASTEROID_UNKNOWN_ROWS]}
            onChange={(next) => onChange({ ...environment, asteroidField: next })}
          />
        </>
      )}
    </section>
  )
}
