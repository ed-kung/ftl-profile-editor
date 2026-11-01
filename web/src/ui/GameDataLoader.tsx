import { useState } from 'react'

import { PackContainer } from '../lib/dat/PackContainer'
import { extractDataPack, type DataPack } from '../lib/datapack'
import { saveCachedDataPack } from '../lib/dataPackStore'
import { Dropzone } from './Dropzone'

interface GameDataLoaderProps {
  onLoaded: (pack: DataPack, cached: boolean) => void
}

/**
 * Asks for "ftl.dat" and extracts the data the editor needs from it.
 *
 * The game's own files are the only place the achievement and ship lists live,
 * and the achievement list decides how a profile's bytes are laid out -- so
 * there is no editing anything without this step. It happens once: the result
 * is cached, and the archive itself is never uploaded anywhere.
 */
export function GameDataLoader({ onLoaded }: GameDataLoaderProps) {
  const [stage, setStage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async (file: File) => {
    setError(null)
    setStage('Reading the archive index')

    try {
      const pack = await PackContainer.open(file, file.name)

      const dataPack = await extractDataPack(
        pack,
        {
          fileName: file.name,
          fileSize: file.size,
          lastModified: file.lastModified,
        },
        setStage,
      )

      setStage('Saving to this browser')
      const cached = await saveCachedDataPack(dataPack)

      onLoaded(dataPack, cached)
    } catch (e) {
      setStage(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="loader">
      <h2>Select your FTL game data</h2>
      <p>
        The editor needs the game's own achievement and ship lists, which live
        inside <code>ftl.dat</code>. You only have to do this once — the small
        part that gets used is kept in this browser afterwards.
      </p>

      {error && (
        <div className="banner danger">
          <h3>Could not read that file</h3>
          <p>{error}</p>
        </div>
      )}

      <Dropzone
        accept=".dat"
        heading="Drop ftl.dat here, or click to browse"
        hint="Nothing is uploaded. The file is read in your browser and stays on your machine."
        disabled={stage !== null}
        onFile={load}
      />

      {stage && <p className="spinner">{stage}…</p>}

      <ul className="hint-list">
        <li>
          macOS:{' '}
          <code>
            /Applications/FTL Advanced Edition.app/Contents/Resources/ftl.dat
          </code>
          <br />
          macOS hides the inside of <code>.app</code> bundles from the file
          picker. Either right-click the app in Finder, choose{' '}
          <strong>Show Package Contents</strong>, and drag{' '}
          <code>ftl.dat</code> here from{' '}
          <code>Contents/Resources</code> — or press{' '}
          <strong>Cmd&nbsp;+&nbsp;Shift&nbsp;+&nbsp;G</strong> in the file
          dialog and paste the path above.
        </li>
        <li>
          Windows:{' '}
          <code>C:\Program Files (x86)\FTL\resources\ftl.dat</code>{' '}
          (Steam: <code>steamapps\common\FTL Faster Than Light\data\resources</code>)
        </li>
        <li>
          Linux: <code>FTL/data/resources/ftl.dat</code>
        </li>
        <li>
          Only the 278&nbsp;MB archive's index is read, not the whole file, so
          this takes about a second.
        </li>
      </ul>
    </div>
  )
}
