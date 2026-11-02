import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DATA_PACK_SCHEMA, type DataPack } from '../src/lib/datapack'

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const DATA_DIR = join(FIXTURE_DIR, 'data')

/** The data files `npm run extract-fixtures` pulls out of an install. */
const DATA_FILE_NAMES = [
  'misc.xml',
  'text_achievements.xml',
  'text_blueprints.xml',
  'text_events.xml',
  'text_misc.xml',
  'text_sectorname.xml',
  'text_tooltips.xml',
  'text_tutorial.xml',
  'achievements.xml',
  'sector_data.xml',
  'blueprints.xml',
  'autoBlueprints.xml',
  'bosses.xml',
  'dlcBlueprints.xml',
  'dlcBlueprintsOverwrite.xml',
  'dlcPirateBlueprints.xml',
]

export const MISSING_DATA_MESSAGE =
  'no extracted game data in test/fixtures/data -- run `npm run extract-fixtures`'

export const MISSING_PROFILE_MESSAGE =
  'no test/fixtures/ae_prof.sav -- see test/fixtures/README.md'

export function hasGameDataFixture(): boolean {
  return existsSync(join(DATA_DIR, 'achievements.xml'))
}

export function hasProfileFixture(): boolean {
  return existsSync(join(FIXTURE_DIR, 'ae_prof.sav'))
}

/** Builds a DataPack from the extracted files. Icons are left out. */
export function loadDataPackFixture(): DataPack {
  const xml: Record<string, string> = {}

  for (const name of DATA_FILE_NAMES) {
    const path = join(DATA_DIR, name)
    if (existsSync(path)) {
      xml[name] = readFileSync(path, 'utf8')
    }
  }

  const layouts: Record<string, string> = {}
  if (existsSync(DATA_DIR)) {
    for (const name of readdirSync(DATA_DIR)) {
      if (name.endsWith('.txt')) {
        layouts[name.slice(0, -4)] = readFileSync(join(DATA_DIR, name), 'utf8')
      }
    }
  }

  return {
    schemaVersion: DATA_PACK_SCHEMA,
    source: {
      fileName: 'ftl.dat',
      fileSize: 0,
      lastModified: 0,
      extractedAt: 0,
    },
    xml,
    layouts,
    icons: {},
  }
}

/** Saved games in test/fixtures, by file name. Any "*.sav" but the profiles. */
export function listSaveFixtures(): string[] {
  return readdirSync(FIXTURE_DIR).filter(
    (name) => name.endsWith('.sav') && !/prof\.sav$/.test(name),
  )
}

export function loadFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURE_DIR, name)))
}

export function loadProfileFixture(): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURE_DIR, 'ae_prof.sav')))
}

export function readFixtureText(name: string): string {
  return readFileSync(join(DATA_DIR, name), 'utf8')
}
