import { describe, expect, it } from 'vitest'

import type { SectorPools } from '../src/lib/data/sectors'
import { RNG_ALGORITHMS, rngChoicesFor, type RandRNG } from '../src/lib/save/rng'
import {
  connectedRows,
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
} from '../src/lib/save/sectorTree'

const rng = (id: string): RandRNG => {
  const algorithm = RNG_ALGORITHMS.find((a) => a.id === id)
  if (!algorithm) throw new Error(id)
  return algorithm.create()
}

const sequence = (generator: RandRNG, seed: number, count: number) => {
  generator.srand(seed)
  return Array.from({ length: count }, () => generator.rand())
}

/** Java's FTL_1_6_Random, long way round, to check the 64-bit shortcut. */
function javaFtl16(seed: number, count: number): number[] {
  const UINT = 0xffffffffn
  let state = BigInt.asUintN(64, BigInt(seed))

  return Array.from({ length: count }, () => {
    const high = (state >> 32n) & UINT
    const low = state & UINT

    let z = 1284865837n * low
    let zHigh = (z >> 32n) & UINT
    zHigh += 1481765933n * low
    zHigh += 1284865837n * high

    z = ((zHigh << 32n) & 0xffffffff00000000n) | (z & UINT)
    z = (z + 1n) & 0xffffffffffffffffn

    state = z
    return Number(z >> 33n)
  })
}

describe('random number generators', () => {
  // The well known first outputs of srand(1) on each platform.
  it('matches glibc', () => {
    expect(sequence(rng('glibc'), 1, 3)).toEqual([1804289383, 846930886, 1681692777])
  })

  it('treats a glibc seed of 0 as 1', () => {
    expect(sequence(rng('glibc'), 0, 3)).toEqual(sequence(rng('glibc'), 1, 3))
  })

  it('matches Microsoft C', () => {
    expect(sequence(rng('ms'), 1, 3)).toEqual([41, 18467, 6334])
  })

  it.each([1, 42, 2147483647, -1, -2147483648])('matches Java for FTL 1.6 seed %i', (seed) => {
    expect(sequence(rng('ftl16'), seed, 50)).toEqual(javaFtl16(seed, 50))
  })

  it('reseeds cleanly', () => {
    const generator = rng('glibc')
    expect(sequence(generator, 7, 5)).toEqual(sequence(generator, 7, 5))
  })

  it('offers only the built-in generator to a native 1.6 game', () => {
    expect(rngChoicesFor(11, false).map((a) => a.id)).toEqual(['ftl16'])
  })

  it('offers platform generators to migrated and older games', () => {
    expect(rngChoicesFor(11, true).map((a) => a.id)).toEqual(['ftl16', 'glibc', 'ms'])
    expect(rngChoicesFor(9, true).map((a) => a.id)).toEqual(['glibc', 'ms'])
  })
})

const choice = (id: string, minSector = 0, unique = false) => ({
  id,
  minSector,
  unique,
  titles: [`${id} one`, `${id} two`],
})

const POOLS: SectorPools = {
  CIVILIAN: [choice('CIV'), choice('CIV_HOME', 1, true)],
  NEBULA: [choice('NEB'), choice('NEB_HOME', 3, true)],
  HOSTILE: [choice('HOS'), choice('HOS_LATE', 5)],
}

describe('randomTree', () => {
  const tree = randomTree(42, rng('ftl16'), POOLS)

  it('has the fixed ends and valid column sizes', () => {
    expect(tree).toHaveLength(8)
    expect(tree[0][0].id).toBe('CIVILIAN_SECTOR')
    expect(tree[7][0].id).toBe('FINAL')
    expect(tree[1]).toHaveLength(2)
    expect(treeProblem(tree)).toBeNull()
  })

  it('is the same for the same seed', () => {
    expect(randomTree(42, rng('ftl16'), POOLS)).toEqual(tree)
  })

  it('differs by seed', () => {
    expect(randomTree(43, rng('ftl16'), POOLS)).not.toEqual(tree)
  })

  it('never repeats a unique sector, or places one too early', () => {
    for (let seed = 0; seed < 200; seed++) {
      const dots = randomTree(seed, rng('ms'), POOLS).flat()

      for (const id of ['CIV_HOME', 'NEB_HOME']) {
        expect(dots.filter((d) => d.id === id).length).toBeLessThanOrEqual(1)
      }

      randomTree(seed, rng('ms'), POOLS).forEach((column, c) => {
        for (const dot of column) {
          if (dot.id === 'HOS_LATE') expect(c).toBeGreaterThanOrEqual(5)
          if (dot.id === 'NEB_HOME') expect(c).toBeGreaterThanOrEqual(3)
        }
      })
    }
  })

  it('says so when a pool runs dry', () => {
    const empty: SectorPools = { CIVILIAN: [], NEBULA: [], HOSTILE: [] }
    expect(() => randomTree(1, rng('ms'), empty)).toThrow(/No .* sector/)
  })
})

describe('linearTree', () => {
  it('keeps every flag, so a route survives unchanged', () => {
    const route = [true, false, true, true, false, false, true, false, false, false]
    expect(routeOf(linearTree(route))).toEqual(route)
  })

  it('gives the first dot its own column', () => {
    expect(linearTree([true, false, true])[0]).toHaveLength(1)
  })

  it('puts unvisited dots ahead of the visited one in a column', () => {
    const columns = linearTree([true, false, false, true, false])
    expect(columns[1].map((d) => d.visited)).toEqual([false, false, true])
  })

  it('never makes more than 8 columns', () => {
    expect(linearTree(new Array(30).fill(false)).length).toBeLessThanOrEqual(8)
    expect(dotCount(linearTree(new Array(30).fill(false)))).toBe(30)
  })
})

const dot = (visited = false) => ({ type: null, id: null, title: 'x', visited })
const sized = (...sizes: number[]): SectorColumns =>
  sizes.map((size) => Array.from({ length: size }, () => dot()))

describe('connectedRows', () => {
  it('joins one dot to all of its neighbour', () => {
    expect(connectedRows(sized(1, 3), 0, 0, true)).toEqual([0, 1, 2])
    expect(connectedRows(sized(3, 1), 0, 2, true)).toEqual([0])
    expect(connectedRows(sized(1, 3), 1, 2, false)).toEqual([0])
  })

  it('joins neighbouring sizes in pairs', () => {
    expect(connectedRows(sized(2, 3), 0, 1, true)).toEqual([1, 2])
    expect(connectedRows(sized(3, 2), 0, 1, true)).toEqual([0, 1])
    expect(connectedRows(sized(3, 4), 0, 2, true)).toEqual([2, 3])
    expect(connectedRows(sized(4, 3), 0, 3, true)).toEqual([2])
    expect(connectedRows(sized(3, 2), 0, 0, true)).toEqual([0])
    expect(connectedRows(sized(3, 2), 0, 2, true)).toEqual([1])
  })

  it('splits 2 and 4 into halves', () => {
    expect(connectedRows(sized(2, 4), 0, 1, true)).toEqual([2, 3])
    expect(connectedRows(sized(4, 2), 0, 1, true)).toEqual([0])
    expect(connectedRows(sized(4, 2), 0, 2, true)).toEqual([1])
  })

  it('stops at the ends of the tree', () => {
    expect(connectedRows(sized(1, 2), 1, 0, true)).toEqual([])
    expect(connectedRows(sized(1, 2), 0, 0, false)).toEqual([])
  })
})

describe('editing the route', () => {
  const tree = withRoute(sized(1, 2, 4), [true, false, true, false, false, false, false])

  it('finds the last visited column', () => {
    expect(lastVisitedColumn(tree)).toBe(1)
    expect(sectorNumberOf(tree)).toBe(1)
    expect(lastVisitedColumn(sized(1, 2))).toBe(-1)
    expect(sectorNumberOf(sized(1, 2))).toBe(0)
  })

  it('offers the dots joined to where the route ends', () => {
    expect(nextRows(tree)).toEqual([2, 3])
  })

  it('moves along the route', () => {
    const moved = setVisited(tree, 2, 3)
    expect(lastVisitedColumn(moved)).toBe(2)
    expect(treeProblem(moved)).toBeNull()
  })

  it('rolls back', () => {
    const moved = setVisited(tree, 2, 3)
    expect(truncateRoute(moved, 1)).toEqual(tree)
  })

  it('leaves dots beyond the route unvisited', () => {
    expect(routeOf(withRoute(sized(1, 2), [true]))).toEqual([true, false, false])
  })

  it('reports impossible routes', () => {
    expect(treeProblem([])).toMatch(/no columns/)
    expect(treeProblem(sized(1, 1))).toMatch(/same size/)
    expect(treeProblem(withRoute(sized(1, 2), [true, true, true]))).toMatch(/Several/)
    expect(treeProblem(withRoute(sized(1, 2, 3), [true, false, false, true]))).toMatch(
      /none in the column before/,
    )
  })
})
