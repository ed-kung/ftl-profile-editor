/**
 * The random number generators FTL has used to build sector trees.
 *
 * Before FTL 1.6.1 the game called its operating system's rand(), so a seed
 * means something different on each platform. Ports of the classes in
 * net.blerf.ftl.parser.random. The Java editor's "Native" option has no
 * equivalent here, since a browser can't reach the OS's rand().
 */

export interface RandRNG {
  srand(seed: number): void
  rand(): number
}

/** FTL 1.6.1+, on every platform. */
class Ftl16Random implements RandRNG {
  private seed = 1n

  srand(seed: number): void {
    this.seed = BigInt.asUintN(64, BigInt(seed))
  }

  rand(): number {
    this.seed = BigInt.asUintN(64, this.seed * 6364136223846793005n + 1n)
    return Number(this.seed >> 33n)
  }
}

/** Microsoft's C runtime. */
class MsRandom implements RandRNG {
  private seed = 1

  srand(seed: number): void {
    this.seed = seed
  }

  rand(): number {
    this.seed = (Math.imul(this.seed, 214013) + 2531011) & 0x7fffffff
    return this.seed >> 16
  }
}

const GLIBC_DEGREE = 31
const GLIBC_SEPARATION = 3

/** The GNU C library's default algorithm (TYPE_3), also a fair match for OSX. */
class GlibcRandom implements RandRNG {
  private state = new Int32Array(GLIBC_DEGREE)
  private front = GLIBC_SEPARATION
  private rear = 0

  constructor() {
    this.srand(1)
  }

  srand(seed: number): void {
    // The seed must not be 0.
    let word = seed === 0 ? 1 : seed

    this.state[0] = word
    for (let i = 1; i < GLIBC_DEGREE; i++) {
      // state[i] = (16807 * state[i - 1]) % 2147483647, without overflowing.
      const hi = Math.trunc(word / 127773)
      const lo = word % 127773
      word = (16807 * lo - 2836 * hi) | 0
      if (word < 0) word += 2147483647
      this.state[i] = word
    }

    this.front = GLIBC_SEPARATION
    this.rear = 0
    for (let i = 0; i < GLIBC_DEGREE * 10; i++) this.rand()
  }

  rand(): number {
    const value = (this.state[this.front] + this.state[this.rear]) | 0
    this.state[this.front] = value

    this.front = (this.front + 1) % GLIBC_DEGREE
    this.rear = (this.rear + 1) % GLIBC_DEGREE

    // Drops the least random bit.
    return (value >> 1) & 0x7fffffff
  }
}

export const RNG_ALGORITHMS = [
  { id: 'ftl16', label: 'FTL 1.6+', create: () => new Ftl16Random() },
  { id: 'glibc', label: 'GLibC (Linux/OSX)', create: () => new GlibcRandom() },
  { id: 'ms', label: 'Microsoft', create: () => new MsRandom() },
] as const

export type RngAlgorithmId = (typeof RNG_ALGORITHMS)[number]['id']

/**
 * The algorithms that could have written a game.
 *
 * Since FTL 1.6.1, a campaign not migrated from an older version uses the
 * built-in one and nothing else.
 */
export function rngChoicesFor(
  fileFormat: number,
  randomNative: boolean,
): (typeof RNG_ALGORITHMS)[number][] {
  if (fileFormat === 11 && !randomNative) {
    return RNG_ALGORITHMS.filter((a) => a.id === 'ftl16')
  }
  return RNG_ALGORITHMS.filter((a) => a.id !== 'ftl16' || fileFormat === 11)
}
