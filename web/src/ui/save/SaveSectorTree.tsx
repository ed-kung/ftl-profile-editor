import { useMemo, useState } from 'react'

import type { GameData } from '../../lib/data/GameData'
import {
  RNG_ALGORITHMS,
  rngChoicesFor,
  type RngAlgorithmId,
} from '../../lib/save/rng'
import {
  dotCount,
  lastVisitedColumn,
  linearTree,
  nextRows,
  randomTree,
  routeOf,
  sectorNumberOf,
  setVisited,
  treeProblem,
  truncateRoute,
  withRoute,
  type SectorColumns,
} from '../../lib/save/sectorTree'
import type { SavedGame } from '../../lib/save/types'
import { toInt } from '../ScoreEditor'

/**
 * The route through the sectors, and the seed behind them.
 *
 * A port of net.blerf.ftl.ui.SavedGameSectorTreePanel and its sectortree
 * panels, with buttons for dots in place of a drawn tree.
 *
 * The file holds a seed and a flat list of flags. The linear view makes no
 * guesses about either; the expanded view must interpret the seed with the
 * right generator, so it is checked against the route before being shown.
 */

const INT_MAX = 2147483647

type TreeView = 'linear' | 'expanded'

interface Props {
  data: GameData
  game: SavedGame
  /** The game as last opened or saved, for Restore. */
  baseline: SavedGame
  onChange: (game: SavedGame) => void
}

export function SaveSectorTree({ data, game, baseline, onChange }: Props) {
  const choices = rngChoicesFor(game.fileFormat, game.randomNative)

  const [algorithmId, setAlgorithmId] = useState<RngAlgorithmId>(choices[0].id)
  const [seedText, setSeedText] = useState(String(game.sectorTreeSeed))
  const [view, setView] = useState<TreeView>('linear')
  const [problem, setProblem] = useState<string | null>(null)

  const pools = useMemo(() => data.getSectorPools(game.dlcEnabled), [data, game.dlcEnabled])

  const generate = (seed: number, id: RngAlgorithmId): SectorColumns => {
    const algorithm = RNG_ALGORITHMS.find((a) => a.id === id)
    if (!algorithm) throw new Error(`Unknown generator: ${id}`)
    if (!pools) throw new Error('The loaded game data has no sector data.')

    return randomTree(seed, algorithm.create(), pools)
  }

  const apply = (columns: SectorColumns, seed: number) => {
    onChange({
      ...game,
      sectorTreeSeed: seed,
      sectorVisitation: routeOf(columns),
      sectorNumber: sectorNumberOf(columns),
    })
  }

  // The expanded view is rebuilt from the game each time, so it can't drift.
  const shown = useMemo((): { columns: SectorColumns; failure: string | null } => {
    const linear = linearTree(game.sectorVisitation)
    if (view === 'linear') return { columns: linear, failure: null }

    try {
      const columns = generate(game.sectorTreeSeed, algorithmId)
      if (dotCount(columns) !== game.sectorVisitation.length) {
        return {
          columns: linear,
          failure:
            `This generator made a tree of ${dotCount(columns)} sectors, but the ` +
            `saved game records ${game.sectorVisitation.length}. It probably used a ` +
            `different generator.`,
        }
      }

      const routed = withRoute(columns, game.sectorVisitation)
      const invalid = treeProblem(routed)
      if (invalid) {
        return {
          columns: linear,
          failure: `The saved route doesn't fit this generator's tree. ${invalid}`,
        }
      }

      return { columns: routed, failure: null }
    } catch (e) {
      return { columns: linear, failure: e instanceof Error ? e.message : String(e) }
    }
   
  }, [view, algorithmId, game.sectorTreeSeed, game.sectorVisitation, pools])

  const expanded = view === 'expanded' && shown.failure === null

  /** A new seed means a new tree: the route restarts at its first sector. */
  const scramble = (seed: number) => {
    try {
      const columns = setVisited(generate(seed, algorithmId), 0, 0)
      setProblem(null)
      setSeedText(String(seed))
      apply(columns, seed)
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    }
  }

  const restore = () => {
    setProblem(null)
    setSeedText(String(baseline.sectorTreeSeed))
    setView('linear')
    onChange({
      ...game,
      sectorTreeSeed: baseline.sectorTreeSeed,
      sectorVisitation: baseline.sectorVisitation,
      sectorNumber: baseline.sectorNumber,
    })
  }

  const lastColumn = lastVisitedColumn(shown.columns)
  const next = expanded ? nextRows(shown.columns) : []

  return (
    <>
      <section className="panel">
        <h2>Sector Route</h2>
        <p className="panel-note">
          Currently in sector {game.sectorNumber + 1}. Use a column's Roll Back
          button to return to it
          {view === 'expanded' ? ', and pick a marked sector to move ahead' : ''}.
          Only the route changes: the current sector's beacons stay as they are.
        </p>

        {(shown.failure || problem) && (
          <div className="banner warn">
            <h3>Could not use that tree</h3>
            <p>{shown.failure ?? problem}</p>
          </div>
        )}

        <div className="sector-tree">
          {shown.columns.map((column, c) => (
            <div className="sector-column" key={c}>
              <div className="sector-column-title">{c + 1}</div>

              {column.map((dot, r) => {
                const isNext = c === lastColumn + 1 && next.includes(r)
                const className = [
                  'sector-dot',
                  dot.visited ? 'is-visited' : '',
                  isNext ? 'is-next' : '',
                  dot.type ? `sector-${dot.type}` : '',
                ].join(' ')

                return (
                  <button
                    key={r}
                    type="button"
                    className={className}
                    disabled={!isNext}
                    aria-pressed={dot.visited}
                    onClick={() => apply(setVisited(shown.columns, c, r), game.sectorTreeSeed)}
                  >
                    {dot.title}
                  </button>
                )
              })}

              {c < lastColumn && (
                <button
                  type="button"
                  className="sector-rollback"
                  onClick={() =>
                    apply(truncateRoute(shown.columns, c), game.sectorTreeSeed)
                  }
                >
                  Roll Back
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Tree</h2>
        <div className="field-grid">
          <label htmlFor="tree-view">View</label>
          <div>
            <select
              id="tree-view"
              value={view}
              onChange={(e) => setView(e.target.value as TreeView)}
            >
              <option value="linear">Linear</option>
              <option value="expanded">Expanded</option>
            </select>
          </div>

          <label htmlFor="tree-algorithm">Generator</label>
          <div>
            <select
              id="tree-algorithm"
              value={algorithmId}
              onChange={(e) => setAlgorithmId(e.target.value as RngAlgorithmId)}
            >
              {choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>

          <label htmlFor="tree-seed">Seed</label>
          <div className="item-row">
            <input
              id="tree-seed"
              type="number"
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
            />
            <button
              type="button"
              disabled={toInt(seedText) === game.sectorTreeSeed}
              onClick={() => scramble(toInt(seedText))}
            >
              Apply
            </button>
          </div>
        </div>

        <div className="add-row">
          <button
            type="button"
            onClick={() => scramble(Math.floor(Math.random() * INT_MAX))}
          >
            Random Seed
          </button>
          <button type="button" onClick={restore}>
            Restore Original Tree
          </button>
        </div>

        <p className="panel-note field-gap">
          A saved game holds a seed that FTL hands to a random number generator,
          so the tree depends on the platform and on any mods. The linear view
          with the original seed is always safe. A new seed needs the generator
          the game itself will use: with the wrong one, FTL's tree won't match
          the route, and the course through it may be glitchy. FTL 1.6.1+ uses
          its own generator on every platform, unless the campaign was migrated
          from an earlier edition.
        </p>
      </section>
    </>
  )
}
