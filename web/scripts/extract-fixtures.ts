/**
 * Extracts the data files the fixture-backed tests need from a real "ftl.dat".
 *
 * Run it against your own install:
 *
 *   npm run extract-fixtures -- "/Applications/FTL Advanced Edition.app/Contents/Resources/ftl.dat"
 *
 * The output lands in test/fixtures/data/ and is gitignored: it is Subset
 * Games' game data, not ours to redistribute. Tests that need it skip
 * themselves when it is absent.
 *
 * This deliberately goes through the same PkgPack the browser uses, so running
 * it also exercises the archive reader against the full 278MB file.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { openAsBlob } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PkgPack } from '../src/lib/dat/PkgPack'
import { TEXT_LOOKUP_FILE_NAMES } from '../src/lib/data/textLookup'
import {
  DLC_BLUEPRINT_FILE_NAMES,
  DLC_PLAYER_SHIP_BASE_IDS,
  STD_BLUEPRINT_FILE_NAMES,
} from '../src/lib/data/ships'

const WANTED = [
  ...TEXT_LOOKUP_FILE_NAMES,
  'achievements.xml',
  ...STD_BLUEPRINT_FILE_NAMES,
  ...DLC_BLUEPRINT_FILE_NAMES,
]

const DEFAULT_DAT =
  '/Applications/FTL Advanced Edition.app/Contents/Resources/ftl.dat'

async function main() {
  const datPath = process.argv[2] ?? DEFAULT_DAT
  const outDir = join(dirname(fileURLToPath(import.meta.url)), '../test/fixtures/data')

  console.log(`Reading ${datPath}`)
  const pack = await PkgPack.open(await openAsBlob(datPath))
  console.log(`  ${pack.size} entries indexed`)

  await mkdir(outDir, { recursive: true })

  let written = 0
  let skipped = 0

  for (const name of WANTED) {
    const innerPath = `data/${name}`
    if (!pack.has(innerPath)) {
      skipped++
      continue
    }

    const bytes = await pack.getBytes(innerPath)
    await writeFile(join(outDir, name), bytes)
    written++
  }

  // The icons too, so the browser harness has something real to render and
  // to put through the downscaler.
  const iconDir = join(outDir, '../img')
  const iconPaths = new Set<string>()

  for (const innerPath of pack.listPaths()) {
    if (innerPath.startsWith('img/achievements/')) iconPaths.add(innerPath)
  }

  const blueprints = (
    await Promise.all(
      [...STD_BLUEPRINT_FILE_NAMES, ...DLC_BLUEPRINT_FILE_NAMES]
        .map((name) => `data/${name}`)
        .filter((p) => pack.has(p))
        .map((p) => pack.getText(p)),
    )
  ).join('\n')

  for (const baseId of DLC_PLAYER_SHIP_BASE_IDS) {
    for (const variantId of [baseId, `${baseId}_2`, `${baseId}_3`]) {
      const match = blueprints.match(
        new RegExp(`<shipBlueprint[^>]*name="${variantId}"[^>]*>`),
      )
      const gfx = match?.[0].match(/img="([^"]+)"/)?.[1]
      if (gfx && pack.has(`img/ship/${gfx}_base.png`)) {
        iconPaths.add(`img/ship/${gfx}_base.png`)
      }
    }
  }

  let icons = 0
  for (const innerPath of iconPaths) {
    const target = join(iconDir, innerPath.replace(/^img\//, ''))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, await pack.getBytes(innerPath))
    icons++
  }

  console.log(`Wrote ${written} files to test/fixtures/data (${skipped} absent in this version)`)
  console.log(`Wrote ${icons} icons to test/fixtures/img`)
  console.log(
    'Also copy your profile if you want the round-trip test to run:\n' +
      '  cp ~/Library/Application\\ Support/FasterThanLight/ae_prof.sav test/fixtures/',
  )
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
