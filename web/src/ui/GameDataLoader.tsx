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
      <h2>General Instructions</h2>
      <ol className="instructions-list">
        <li>
          Upload game data file (<code>ftl.dat</code>)
        </li>
        <li>
          Upload profile file (<code>ae_prof.sav</code> or <code>prof.sav</code>)
        </li>
        <li>
          Edit the profile and download the modified profile. Replace the original profile file with modified file. (Don't forget to back up the original!)
        </li>
      </ol>

      <h2>Upload ftl.dat</h2>
      <p>
        First, you need to upload your <code>ftl.dat</code> file. You should only have to do this once on this browser.
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

      <h3>Default file locations:</h3>
      <ul className="hint-list">
        <li>
          macOS:{' '}
          <code>
            /Applications/FTL Advanced Edition.app/Contents/Resources/ftl.dat
          </code>
        </li>
        <li>
          Windows:{' '}
          <code>C:\Program Files (x86)\FTL\resources\ftl.dat</code>
        </li>
        <li>
          Steam: <code>steamapps\common\FTL Faster Than Light\data\resources\ftl.dat</code>
        </li>
        <li>
          Linux: <code>FTL/data/resources/ftl.dat</code>
        </li>
      </ul>
    </div>
  )
}
