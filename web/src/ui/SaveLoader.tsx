import { useState } from 'react'

import { Dropzone } from './Dropzone'

interface SaveLoaderProps {
  onFile: (file: File, bytes: Uint8Array) => void
  error: string | null
}

/** Asks for the saved game: "continue.sav". */
export function SaveLoader({ onFile, error }: SaveLoaderProps) {
  const [busy, setBusy] = useState(false)

  const load = async (file: File) => {
    setBusy(true)
    try {
      onFile(file, new Uint8Array(await file.arrayBuffer()))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="loader">
      <h2>Upload continue.sav</h2>
      <p>
        Upload the saved game to edit. FTL keeps one, and only while a run is in
        progress. Use "Save and Quit" in FTL and close the game before uploading,
        and keep a copy of the original.
      </p>
      <p>
        When you are done, download the modified file and put it in place of the
        original.
      </p>

      {error && (
        <div className="banner danger">
          <h3>Could not read that saved game</h3>
          <p>{error}</p>
        </div>
      )}

      <Dropzone
        accept=".sav"
        heading="Drop continue.sav here, or click to browse"
        hint="Nothing is uploaded. The file is read in your browser and stays on your machine."
        disabled={busy}
        onFile={load}
      />

      <h3>Default file locations:</h3>
      <ul className="hint-list">
        <li>
          macOS:{' '}
          <code>~/Library/Application Support/FasterThanLight/continue.sav</code>
        </li>
        <li>
          Windows:{' '}
          <code>%USERPROFILE%\Documents\My Games\FasterThanLight\continue.sav</code>
        </li>
        <li>
          Linux: <code>~/.local/share/FasterThanLight/continue.sav</code>
        </li>
      </ul>
    </div>
  )
}
