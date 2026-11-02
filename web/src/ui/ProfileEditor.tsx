import { useEffect, useState, type ReactNode } from 'react'

import type { GameData } from '../lib/data/GameData'
import { describeFirstDifference } from '../lib/io/compareBytes'
import { download } from '../lib/io/download'
import { readProfile, writeProfile } from '../lib/profile/ProfileParser'
import type { Profile } from '../lib/profile/types'
import { Credits, Header } from './AppChrome'
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

interface Props {
  data: GameData
  cachePersisted: boolean
  modeSwitch: ReactNode
  onReplaceGameData: () => void
  onDirtyChange: (dirty: boolean) => void
}

export function ProfileEditor({
  data,
  cachePersisted,
  modeSwitch,
  onReplaceGameData,
  onDirtyChange,
}: Props) {
  const [open, setOpen] = useState<OpenProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabName>('Ship Unlocks')
  const [dirty, setDirty] = useState(false)

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

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
      const message = e instanceof Error ? e.message : String(e)
      setProfileError(
        /continue\.sav$/i.test(file.name)
          ? `${message} This looks like a saved game: open it under Saved Game instead.`
          : message,
      )
    }
  }

  if (!open) {
    return (
      <>
        <Header
          data={data}
          modeSwitch={modeSwitch}
          onReplaceGameData={onReplaceGameData}
        />
        <ProfileLoader onFile={openProfileFile} error={profileError} />
        <Credits />
      </>
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
    <>
      <Header
        data={data}
        fileLabel={`Profile: ${open.fileName}${formatLabel(profile.fileFormat)}`}
        dirty={dirty}
        saveDisabledReason={
          blocked ? 'Disabled: this profile did not survive a test rewrite' : null
        }
        onSave={save}
        onBackup={() => download(open.originalBytes, `${open.fileName}.backup`)}
        onClose={() => {
          if (dirty && !window.confirm('Discard unsaved changes?')) return
          setOpen(null)
          setDirty(false)
        }}
        onReplaceGameData={onReplaceGameData}
        modeSwitch={modeSwitch}
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

      {!cachePersisted && <CacheWarning />}

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
    </>
  )
}

export function CacheWarning() {
  return (
    <div className="banner info">
      <h3>Game data could not be cached in this browser</h3>
      <p>
        Everything works, but you will have to select <code>ftl.dat</code>{' '}
        again next visit. Private windows and blocked site data do this.
      </p>
    </div>
  )
}

function formatLabel(fileFormat: number): string {
  if (fileFormat === 4) return ' (FTL 1.01–1.03.3)'
  if (fileFormat === 9) return ' (FTL 1.5.4+)'
  return ''
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
  // Expected: the skipped records are gone, so the bytes cannot match.
  if (skippedAchievementIds.length > 0) return null

  return describeFirstDifference(original, rewritten)
}
