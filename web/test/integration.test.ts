// @vitest-environment node
//
// The archive reader works over Blobs; jsdom's lack arrayBuffer(). DOMParser,
// which the game-data layer needs, is supplied by jsdom below.
import { existsSync } from 'node:fs'
import { openAsBlob } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'

import { GameData } from '../src/lib/data/GameData'
import { PackContainer } from '../src/lib/dat/PackContainer'
import { extractDataPack } from '../src/lib/datapack'
import { readProfile, writeProfile } from '../src/lib/profile/ProfileParser'
import { findShipUnlock } from '../src/lib/profile/types'
import { hasProfileFixture, loadProfileFixture } from './fixtures'

const DAT_PATH =
  process.env.FTL_DAT ??
  '/Applications/FTL Advanced Edition.app/Contents/Resources/ftl.dat'

const haveDat = existsSync(DAT_PATH)

// The data layer uses DOMParser, and extractDataPack uses URL.createObjectURL.
globalThis.DOMParser = new JSDOM().window.DOMParser

// Skipped unless both a real install and a real profile are present. Point
// FTL_DAT at your own ftl.dat if it isn't where macOS puts it.
describe.skipIf(!haveDat || !hasProfileFixture())(
  'the whole pipeline, against a real install',
  () => {
    it('goes from ftl.dat and a profile to an edited profile', async () => {
      // 1. Open the archive. Only the index is read, not all 278MB.
      const pack = await PackContainer.openFtlDat(await openAsBlob(DAT_PATH))
      expect(pack.size).toBeGreaterThan(3000)
      expect(pack.has('data/blueprints.xml')).toBe(true)

      // 2. Extract the subset the editor needs. Icon downscaling needs
      //    OffscreenCanvas, which Node lacks -- it has to degrade, not throw.
      const stages: string[] = []
      const dataPack = await extractDataPack(
        pack,
        { fileName: 'ftl.dat', fileSize: 0, lastModified: 0 },
        (stage) => stages.push(stage),
      )

      expect(stages[0]).toBe('Reading text')
      expect(Object.keys(dataPack.xml)).toContain('achievements.xml')
      expect(Object.keys(dataPack.xml)).toContain('dlcBlueprintsOverwrite.xml')

      // Both the achievement icons and the player ships' hull sprites.
      const iconPaths = Object.keys(dataPack.icons)
      expect(iconPaths.filter((p) => p.startsWith('img/achievements/')).length)
        .toBeGreaterThan(50)
      expect(iconPaths.filter((p) => p.startsWith('img/ship/')).length).toBe(28)

      // The point of extracting: a couple of megabytes instead of 278.
      const xmlBytes = Object.values(dataPack.xml).reduce(
        (sum, text) => sum + text.length,
        0,
      )
      expect(xmlBytes).toBeLessThan(2_000_000)

      // 3. Index it. GameData hands out blob: URLs for the icons.
      const urls: string[] = []
      globalThis.URL.createObjectURL = () => {
        const url = `blob:fake/${urls.length}`
        urls.push(url)
        return url
      }
      globalThis.URL.revokeObjectURL = () => {}

      const data = GameData.fromPack(dataPack)
      expect(data.getPlayerShipBaseIds()).toHaveLength(10)
      expect(data.getAchievement('ACH_SECTOR_5')?.name).toBe('Just Getting Started')

      // 4. Read the profile and confirm it rewrites byte for byte.
      const original = loadProfileFixture()
      const { profile, skippedAchievementIds } = readProfile(original, data)

      expect(skippedAchievementIds).toEqual([])
      expect([...writeProfile(profile, data).bytes]).toEqual([...original])

      // 5. Make the edit the editor exists for, and check the cost in bytes.
      const crystal = findShipUnlock(profile.shipUnlocks, 'PLAYER_SHIP_CRYSTAL')
      expect(crystal, 'the profile should have a Crystal Cruiser slot').toBeDefined()

      const edited = {
        ...profile,
        shipUnlocks: profile.shipUnlocks.map((avail) =>
          avail.shipId === 'PLAYER_SHIP_CRYSTAL'
            ? { ...avail, unlockedA: !avail.unlockedA }
            : avail,
        ),
      }

      const { bytes: editedBytes } = writeProfile(edited, data)

      expect(editedBytes.length).toBe(original.length)

      const differing = [...editedBytes]
        .map((b, i) => (b === original[i] ? -1 : i))
        .filter((i) => i !== -1)

      // One bool is one little-endian int, and flipping it touches only its
      // low byte. Anything more means an unrelated field moved.
      expect(differing).toHaveLength(1)
      expect(Math.abs(editedBytes[differing[0]] - original[differing[0]])).toBe(1)

      // 6. And the edit survives a round trip.
      const reread = readProfile(editedBytes, data).profile
      expect(
        findShipUnlock(reread.shipUnlocks, 'PLAYER_SHIP_CRYSTAL')?.unlockedA,
      ).toBe(!crystal!.unlockedA)

      data.dispose()
    }, 60_000)
  },
)
