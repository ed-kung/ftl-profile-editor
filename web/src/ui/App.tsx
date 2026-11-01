import { useEffect, useMemo, useState } from 'react'

import { GameData } from '../lib/data/GameData'
import { toBlob } from '../lib/io/blob'
import type { DataPack } from '../lib/datapack'
import { clearCachedDataPack, loadCachedDataPack } from '../lib/dataPackStore'
import { readProfile, writeProfile } from '../lib/profile/ProfileParser'
import type { Profile } from '../lib/profile/types'
import { GameDataLoader } from './GameDataLoader'
import { ProfileLoader } from './ProfileLoader'
import { Dump } from './tabs/Dump'
import { GeneralAchievements } from './tabs/GeneralAchievements'
import { GeneralStats } from './tabs/GeneralStats'
import { ShipStats } from './tabs/ShipStats'
import { ShipUnlocks } from './tabs/ShipUnlocks'

const TABS = [
  'Ship Unlocks',
  'General Achievements',
  'General Stats',
  'Ship Stats',
  'Dump',
] as const

type TabName = (typeof TABS)[number]

interface OpenProfile {
  fileName: string
  /** The bytes as they arrived, for the round-trip check and the backup. */
  originalBytes: Uint8Array
  profile: Profile
  skippedAchievementIds: string[]
  /** Set when re-serialising the untouched profile did not reproduce it. */
  roundTripProblem: string | null
}

export function App() {
  const [dataPack, setDataPack] = useState<DataPack | null>(null)
  const [cacheState, setCacheState] = useState<'loading' | 'ready'>('loading')
  const [cachePersisted, setCachePersisted] = useState(true)

  const [open, setOpen] = useState<OpenProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabName>('Ship Unlocks')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    void loadCachedDataPack().then((cached) => {
      if (cached) setDataPack(cached)
      setCacheState('ready')
    })
  }, [])

  const data = useMemo(
    () => (dataPack ? GameData.fromPack(dataPack) : null),
    [dataPack],
  )

  useEffect(() => () => data?.dispose(), [data])

  // Browsers only honour this after the user has interacted with the page,
  // which by this point they have.
  useEffect(() => {
    if (!dirty) return

    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (cacheState === 'loading') {
    return (
      <div className="app">
        <p className="spinner">Loading…</p>
      </div>
    )
  }

  if (!dataPack || !data) {
    return (
      <div className="app">
        <Header />
        <GameDataLoader
          onLoaded={(pack, cached) => {
            setDataPack(pack)
            setCachePersisted(cached)
          }}
        />
      </div>
    )
  }

  const openProfileFile = (file: File, bytes: Uint8Array) => {
    setProfileError(null)

    try {
      const { profile, skippedAchievementIds } = readProfile(bytes, data)

      // Re-serialise straight away: if an untouched profile does not come back
      // byte for byte, something in the format is misunderstood and saving
      // would risk a profile FTL can't read.
      let roundTripProblem: string | null = null
      try {
        const { bytes: rewritten } = writeProfile(profile, data)
        roundTripProblem = compareBytes(bytes, rewritten, skippedAchievementIds)
      } catch (e) {
        roundTripProblem = `Re-serialising the profile failed: ${
          e instanceof Error ? e.message : String(e)
        }`
      }

      setOpen({
        fileName: file.name,
        originalBytes: bytes,
        profile,
        skippedAchievementIds,
        roundTripProblem,
      })
      setDirty(false)
      setTab('Ship Unlocks')
    } catch (e) {
      setOpen(null)
      setProfileError(e instanceof Error ? e.message : String(e))
    }
  }

  if (!open) {
    return (
      <div className="app">
        <Header
          data={data}
          cachePersisted={cachePersisted}
          onReplaceGameData={async () => {
            await clearCachedDataPack()
            setDataPack(null)
          }}
        />
        <ProfileLoader onFile={openProfileFile} error={profileError} />
      </div>
    )
  }

  const { profile } = open
  const blocked = open.roundTripProblem !== null

  const update = (next: Profile) => {
    setOpen({ ...open, profile: next })
    setDirty(true)
  }

  const save = () => {
    const { bytes, droppedAchievementIds } = writeProfile(profile, data)

    if (droppedAchievementIds.length > 0) {
      const ok = window.confirm(
        `These achievements cannot be stored in this profile and will be ` +
          `dropped:\n\n${droppedAchievementIds.join('\n')}\n\nSave anyway?`,
      )
      if (!ok) return
    }

    download(bytes, open.fileName)
    setDirty(false)
  }

  return (
    <div className="app">
      <Header
        data={data}
        cachePersisted={cachePersisted}
        fileName={open.fileName}
        fileFormat={profile.fileFormat}
        dirty={dirty}
        saveDisabled={blocked}
        onSave={save}
        onBackup={() =>
          download(open.originalBytes, `${open.fileName}.backup`)
        }
        onClose={() => {
          if (dirty && !window.confirm('Discard unsaved changes?')) return
          setOpen(null)
          setDirty(false)
        }}
        onReplaceGameData={async () => {
          if (dirty && !window.confirm('Discard unsaved changes?')) return
          await clearCachedDataPack()
          setOpen(null)
          setDirty(false)
          setDataPack(null)
        }}
      />

      {open.roundTripProblem && (
        <div className="banner danger">
          <h3>Saving is disabled: this profile did not survive a test rewrite</h3>
          <p>{open.roundTripProblem}</p>
          <p>
            This usually means the game data loaded here does not match the FTL
            version that wrote the profile. Try replacing the game data with the{' '}
            <code>ftl.dat</code> from the install you actually play. Editing
            below is safe to explore — nothing is written to disk — but the file
            it would produce is not trustworthy, so please report this rather
            than working around it.
          </p>
        </div>
      )}

      {open.skippedAchievementIds.length > 0 && (
        <div className="banner warn">
          <h3>
            {open.skippedAchievementIds.length} achievement
            {open.skippedAchievementIds.length === 1 ? '' : 's'} in this profile
            are unknown to the loaded game data
          </h3>
          <p>
            They will be dropped if you save:{' '}
            <code>{open.skippedAchievementIds.join(', ')}</code>
          </p>
          <p>
            That is expected if you have since uninstalled a mod. Otherwise,
            check you selected the right <code>ftl.dat</code>.
          </p>
        </div>
      )}

      {!cachePersisted && (
        <div className="banner info">
          <h3>Game data could not be cached in this browser</h3>
          <p>
            Everything works, but you will have to select <code>ftl.dat</code>{' '}
            again next visit. Private windows and blocked site data do this.
          </p>
        </div>
      )}

      <div className="tabs" role="tablist">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === 'Ship Unlocks' && (
        <ShipUnlocks data={data} profile={profile} onChange={update} />
      )}
      {tab === 'General Achievements' && (
        <GeneralAchievements data={data} profile={profile} onChange={update} />
      )}
      {tab === 'General Stats' && (
        <GeneralStats profile={profile} onChange={update} />
      )}
      {tab === 'Ship Stats' && (
        <ShipStats data={data} profile={profile} onChange={update} />
      )}
      {tab === 'Dump' && (
        <Dump data={data} profile={profile} fileName={open.fileName} />
      )}
    </div>
  )
}

interface HeaderProps {
  data?: GameData
  cachePersisted?: boolean
  fileName?: string
  fileFormat?: number
  dirty?: boolean
  saveDisabled?: boolean
  onSave?: () => void
  onBackup?: () => void
  onClose?: () => void
  onReplaceGameData?: () => void
}

function Header({
  data,
  fileName,
  fileFormat,
  dirty,
  saveDisabled,
  onSave,
  onBackup,
  onClose,
  onReplaceGameData,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div>
        <h1>FTL Profile Editor</h1>
        <div className="header-meta">
          {data && (
            <span>
              Game data: {data.pack.source.fileName}
              {onReplaceGameData && (
                <>
                  {' '}
                  <button
                    type="button"
                    style={{ padding: '1px 6px', fontSize: 11 }}
                    onClick={onReplaceGameData}
                  >
                    Replace
                  </button>
                </>
              )}
            </span>
          )}
          {fileName && (
            <span>
              Profile: {fileName}
              {fileFormat === 4 && ' (FTL 1.01–1.03.3)'}
              {fileFormat === 9 && ' (FTL 1.5.4+)'}
              {dirty && ' — unsaved changes'}
            </span>
          )}
        </div>
      </div>

      {onSave && (
        <div className="header-actions">
          <button type="button" onClick={onBackup}>
            Download backup
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="primary"
            disabled={saveDisabled}
            onClick={onSave}
            title={
              saveDisabled
                ? 'Disabled: this profile did not survive a test rewrite'
                : undefined
            }
          >
            Save
          </button>
        </div>
      )}
    </header>
  )
}

/**
 * Describes the first difference between the original and a rewrite.
 *
 * Returns null when they match. A profile carrying achievements this install
 * doesn't define will legitimately come out shorter, so that case is reported
 * as what it is rather than as a format failure.
 */
function compareBytes(
  original: Uint8Array,
  rewritten: Uint8Array,
  skippedAchievementIds: string[],
): string | null {
  if (
    original.length === rewritten.length &&
    original.every((b, i) => b === rewritten[i])
  ) {
    return null
  }

  if (skippedAchievementIds.length > 0) {
    // Expected: the skipped records are gone, so the bytes cannot match.
    return null
  }

  const limit = Math.min(original.length, rewritten.length)
  for (let i = 0; i < limit; i++) {
    if (original[i] !== rewritten[i]) {
      return (
        `Rewriting the profile unchanged produced different bytes, starting at ` +
        `offset ${i} (original 0x${hex(original[i])}, rewritten 0x${hex(rewritten[i])}).`
      )
    }
  }

  return (
    `Rewriting the profile unchanged produced ${rewritten.length} bytes ` +
    `instead of ${original.length}.`
  )
}

function hex(byte: number): string {
  return byte.toString(16).padStart(2, '0')
}

function download(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(toBlob(bytes, 'application/octet-stream'))

  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()

  // Give the browser a moment to start the download before dropping the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
