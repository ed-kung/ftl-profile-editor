import { useEffect, useState, type ReactNode } from 'react'

import type { GameData } from '../lib/data/GameData'
import { describeFirstDifference } from '../lib/io/compareBytes'
import { download } from '../lib/io/download'
import {
  canWriteFormat,
  readSavedGame,
  writeSavedGame,
} from '../lib/save/SaveParser'
import { SAVE_FORMAT_LABELS, type SavedGame } from '../lib/save/types'
import { Credits, Header } from './AppChrome'
import { CacheWarning } from './ProfileEditor'
import { SaveLoader } from './SaveLoader'
import { SaveDump } from './save/SaveDump'
import { SaveGeneral } from './save/SaveGeneral'
import { SaveSectorTree } from './save/SaveSectorTree'
import { SaveShip } from './save/SaveShip'
import { SaveStateVars } from './save/SaveStateVars'

const TABS = ['General', 'Ship', 'Sector Tree', 'State Vars', 'Dump'] as const

type TabName = (typeof TABS)[number]

interface OpenSave {
  fileName: string
  /** The bytes as they arrived, for the backup. */
  originalBytes: Uint8Array
  game: SavedGame
  /** The game as last opened or saved. */
  baseline: SavedGame
  /** Set when an untouched save didn't come back byte for byte. */
  roundTripProblem: string | null
}

interface Props {
  data: GameData
  cachePersisted: boolean
  modeSwitch: ReactNode
  onReplaceGameData: () => void
  onDirtyChange: (dirty: boolean) => void
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * Writes a game, then proves the result reads back.
 *
 * Edits can change the file's shape, and a mistake there would show up only
 * when FTL fails to load the game. This catches it while the player still has
 * the original to hand.
 */
function serialiseChecked(game: SavedGame, data: GameData): Uint8Array {
  const bytes = writeSavedGame(game)
  const problem = describeFirstDifference(
    bytes,
    writeSavedGame(readSavedGame(bytes, data)),
  )
  if (problem) throw new Error(problem)
  return bytes
}

export function SaveEditor({
  data,
  cachePersisted,
  modeSwitch,
  onReplaceGameData,
  onDirtyChange,
}: Props) {
  const [open, setOpen] = useState<OpenSave | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabName>('General')
  const [dirty, setDirty] = useState(false)

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  const openFile = (file: File, bytes: Uint8Array) => {
    setOpenError(null)
    setSaveError(null)

    try {
      const game = readSavedGame(bytes, data)

      let roundTripProblem: string | null = null
      if (canWriteFormat(game.fileFormat)) {
        try {
          roundTripProblem = describeFirstDifference(bytes, writeSavedGame(game))
        } catch (e) {
          roundTripProblem = `Re-serialising the saved game failed: ${messageOf(e)}`
        }
      }

      setOpen({
        fileName: file.name,
        originalBytes: bytes,
        game,
        baseline: game,
        roundTripProblem,
      })
      setDirty(false)
      setTab('General')
    } catch (e) {
      setOpen(null)
      setOpenError(
        /prof\.sav$/i.test(file.name)
          ? `${messageOf(e)} This looks like a profile: open it under Profile instead.`
          : messageOf(e),
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
        <SaveLoader onFile={openFile} error={openError} />
        <Credits />
      </>
    )
  }

  const { game } = open
  const readOnly = !canWriteFormat(game.fileFormat)

  const update = (next: SavedGame) => {
    setOpen({ ...open, game: next })
    setSaveError(null)
    setDirty(true)
  }

  const save = () => {
    try {
      download(serialiseChecked(game, data), open.fileName)
      setOpen({ ...open, baseline: game })
      setSaveError(null)
      setDirty(false)
    } catch (e) {
      setSaveError(messageOf(e))
    }
  }

  let saveDisabledReason: string | null = null
  if (readOnly) {
    saveDisabledReason = 'Disabled: saved games this old can be read but not written'
  } else if (open.roundTripProblem) {
    saveDisabledReason = 'Disabled: this saved game did not survive a test rewrite'
  }

  const label = SAVE_FORMAT_LABELS[game.fileFormat]

  return (
    <>
      <Header
        data={data}
        fileLabel={`Saved game: ${open.fileName}${label ? ` (${label})` : ''}`}
        dirty={dirty}
        saveDisabledReason={saveDisabledReason}
        onSave={save}
        onBackup={() => download(open.originalBytes, `${open.fileName}.backup`)}
        onClose={() => {
          if (dirty && !window.confirm('Discard unsaved changes?')) return
          setOpen(null)
          setSaveError(null)
          setDirty(false)
        }}
        onReplaceGameData={onReplaceGameData}
        modeSwitch={modeSwitch}
      />

      {readOnly && (
        <div className="banner warn">
          <h3>This saved game is read-only</h3>
          <p>
            It comes from FTL 1.03.3 or earlier, a format the editor can show but
            not write. Changes made here can't be saved.
          </p>
        </div>
      )}

      {open.roundTripProblem && (
        <div className="banner danger">
          <h3>Saving is disabled: this saved game did not survive a test rewrite</h3>
          <p>{open.roundTripProblem}</p>
          <p>
            This usually means the game data loaded here does not match the FTL
            version that wrote the saved game, or that a mod changed a ship.
            Try replacing the game data with the <code>ftl.dat</code> from the
            install you actually play. Editing below is safe to explore, since
            nothing is written to disk, but the file it would produce is not
            trustworthy, so please report this rather than working around it.
          </p>
        </div>
      )}

      {saveError && (
        <div className="banner danger">
          <h3>Nothing was downloaded: the edited file did not check out</h3>
          <p>{saveError}</p>
          <p>
            The editor wrote the file, read it back, and got something different.
            Your original is untouched. Please report this.
          </p>
        </div>
      )}

      {!cachePersisted && <CacheWarning />}

      <div className="tabs" role="tablist" aria-label="Saved game sections">
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

      {tab === 'General' && <SaveGeneral data={data} game={game} onChange={update} />}
      {tab === 'Ship' && <SaveShip data={data} game={game} onChange={update} />}
      {tab === 'Sector Tree' && (
        <SaveSectorTree
          data={data}
          game={game}
          baseline={open.baseline}
          onChange={update}
        />
      )}
      {tab === 'State Vars' && <SaveStateVars game={game} onChange={update} />}
      {tab === 'Dump' && (
        <SaveDump data={data} game={game} fileName={open.fileName} />
      )}
    </>
  )
}
