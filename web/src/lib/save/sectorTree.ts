import type { SectorChoice, SectorPools } from '../data/sectors'
import type { RandRNG } from './rng'

/**
 * The sector tree: the eight columns of sectors shown between sectors.
 *
 * A saved game stores only a seed and a flat list of visited flags, one per
 * dot, read column by column. Everything here works on plain arrays, and every
 * edit returns a new tree.
 *
 * A port of net.blerf.ftl.model.sectortree.SectorTree and the generators in
 * net.blerf.ftl.parser.sectortree.
 */

export interface SectorDot {
  /** CIVILIAN, NEBULA or HOSTILE. Null when the tree is only a route. */
  type: string | null
  id: string | null
  title: string
  visited: boolean
}

export type SectorColumns = SectorDot[][]

const COLUMN_COUNT = 8

const unknownDot = (visited: boolean): SectorDot => ({
  type: null,
  id: null,
  title: 'Unknown',
  visited,
})

/**
 * Lays out a route with no knowledge of the real tree.
 *
 * It isn't a valid tree, but it holds every flag and needs no seed: subsequent
 * columns hold 0 or more unvisited dots then 1 visited, and the last column
 * takes any excess.
 */
export function linearTree(route: boolean[]): SectorColumns {
  const lastVisited = route.lastIndexOf(true)

  let column: SectorDot[] = []
  const columns: SectorColumns = [column]

  route.forEach((visited, r) => {
    column.push(unknownDot(visited))

    if ((r === 0 || visited || r > lastVisited) && columns.length < COLUMN_COUNT) {
      column = []
      columns.push(column)
    }
  })

  return columns
}

function randomSectorType(rng: RandRNG): keyof SectorPools {
  const n = rng.rand() % 10
  if (n <= 1) return 'NEBULA'
  if (n > 5) return 'HOSTILE'
  return 'CIVILIAN'
}

/** From 2 to 4, differing from the previous column. Column 1 is always 2. */
function randomColumnSize(rng: RandRNG, column: number, previousSize: number): number {
  let size = 0
  do {
    size = (rng.rand() % 3) + 2
  } while (size === previousSize)

  return column === 1 ? 2 : size
}

/** Rebuilds the tree a seed produces. @throws if the pools run out of sectors */
export function randomTree(
  seed: number,
  rng: RandRNG,
  pools: SectorPools,
): SectorColumns {
  rng.srand(seed)

  const usedUniqueIds = new Set<string>()
  const columns: SectorColumns = []
  let columnSize = 0

  for (let c = 0; c < COLUMN_COUNT; c++) {
    if (c === 0) {
      randomSectorType(rng) // Discarded, but the game makes this call.
      columns.push([
        { type: 'CIVILIAN', id: 'CIVILIAN_SECTOR', title: 'Civilian Sector', visited: false },
      ])
      continue
    }
    if (c === COLUMN_COUNT - 1) {
      randomSectorType(rng) // As above.
      columns.push([
        { type: 'HOSTILE', id: 'FINAL', title: 'The Last Stand', visited: false },
      ])
      continue
    }

    columnSize = randomColumnSize(rng, c, columnSize)

    // Types are all drawn before any sector is.
    const types: Array<keyof SectorPools> = []
    for (let d = 0; d < columnSize; d++) types.push(randomSectorType(rng))

    columns.push(
      types.map((type) => {
        const candidates: SectorChoice[] = pools[type].filter(
          (s) => s.minSector <= c && !usedUniqueIds.has(s.id),
        )
        if (candidates.length === 0) {
          throw new Error(`No ${type} sector is available for column ${c}.`)
        }

        const sector = candidates[rng.rand() % candidates.length]
        if (sector.unique) usedUniqueIds.add(sector.id)

        const title =
          sector.titles.length > 0
            ? sector.titles[rng.rand() % sector.titles.length]
            : sector.id

        return { type, id: sector.id, title, visited: false }
      }),
    )
  }

  return columns
}

export function dotCount(columns: SectorColumns): number {
  return columns.reduce((sum, column) => sum + column.length, 0)
}

export function routeOf(columns: SectorColumns): boolean[] {
  return columns.flat().map((dot) => dot.visited)
}

/** Sets each dot's flag. Dots beyond the route's end are left unvisited. */
export function withRoute(columns: SectorColumns, route: boolean[]): SectorColumns {
  let at = 0
  return columns.map((column) =>
    column.map((dot) => ({ ...dot, visited: route[at++] ?? false })),
  )
}

/** The last column with a visited dot, or -1. */
export function lastVisitedColumn(columns: SectorColumns): number {
  for (let c = columns.length - 1; c >= 0; c--) {
    if (columns[c].some((dot) => dot.visited)) return c
  }
  return -1
}

/** The 0-based sector number the game stores alongside a route. */
export function sectorNumberOf(columns: SectorColumns): number {
  return Math.max(0, lastVisitedColumn(columns))
}

/** Clears the route beyond a column. */
export function truncateRoute(columns: SectorColumns, lastColumn: number): SectorColumns {
  return columns.map((column, c) =>
    c > lastColumn ? column.map((dot) => ({ ...dot, visited: false })) : column,
  )
}

export function setVisited(
  columns: SectorColumns,
  column: number,
  row: number,
): SectorColumns {
  return columns.map((dots, c) =>
    c === column
      ? dots.map((dot, r) => (r === row ? { ...dot, visited: true } : dot))
      : dots,
  )
}

/**
 * The rows joined to a dot in the next or previous column.
 *
 * The game draws lines by the sizes of the two columns: one dot joins to all,
 * neighbours sizes (2 and 3, 3 and 4) join each dot to two, and 2 and 4 join
 * each dot to its own half.
 */
export function connectedRows(
  columns: SectorColumns,
  originColumn: number,
  originRow: number,
  forward: boolean,
): number[] {
  const otherColumn = originColumn + (forward ? 1 : -1)
  if (otherColumn < 0 || otherColumn >= columns.length) return []

  const originSize = columns[originColumn].length
  const otherSize = columns[otherColumn].length
  const allRows = Array.from({ length: otherSize }, (_, r) => r)

  // Whichever column is smaller decides how the two are wired.
  const originIsSmaller = otherSize >= originSize
  const smallSize = Math.min(originSize, otherSize)
  const bigSize = Math.max(originSize, otherSize)

  if (smallSize === 1) return allRows

  if (smallSize === bigSize - 1) {
    return originIsSmaller
      ? [originRow, originRow + 1]
      : allRows.filter((r) => r === originRow || r + 1 === originRow)
  }

  if (smallSize * smallSize === bigSize) {
    return originIsSmaller
      ? allRows.filter((r) => Math.floor(r / smallSize) === originRow)
      : [Math.floor(originRow / smallSize)]
  }

  return []
}

/** The dots the route could move to next. */
export function nextRows(columns: SectorColumns): number[] {
  const column = lastVisitedColumn(columns)
  if (column < 0 || column + 1 >= columns.length) return []

  const row = columns[column].findIndex((dot) => dot.visited)
  return connectedRows(columns, column, row, true)
}

/** A problem that makes a tree and route impossible, or null. */
export function treeProblem(columns: SectorColumns): string | null {
  if (columns.length === 0) return 'The tree has no columns.'

  let previousSize = 0
  let previousVisited = true

  for (let c = 0; c < columns.length; c++) {
    const column = columns[c]
    if (column.length === 0) return `Column ${c} is empty.`
    if (column.length === previousSize) {
      return `Column ${c} is the same size as the one before it.`
    }

    const visited = column.filter((dot) => dot.visited).length
    if (visited > 1) return `Several dots in column ${c} were visited.`
    if (visited > 0 && !previousVisited) {
      return `A dot in column ${c} was visited, but none in the column before.`
    }

    previousSize = column.length
    previousVisited = visited > 0
  }

  return null
}
