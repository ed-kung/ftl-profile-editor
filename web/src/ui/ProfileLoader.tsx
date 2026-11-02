import { useState } from 'react'

import { Dropzone } from './Dropzone'

interface ProfileLoaderProps {
  onFile: (file: File, bytes: Uint8Array) => void
  error: string | null
}

/** Asks for the profile itself: "ae_prof.sav" or the older "prof.sav". */
export function ProfileLoader({ onFile, error }: ProfileLoaderProps) {
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
      <p>
        For the saved game of a run in progress (<code>continue.sav</code>), use
        the Saved Game tab above.
      </p>

      <h2>Upload ae_prof.sav or prof.sav</h2>
      <p>
        Upload the profile file to edit. Advanced Edition uses <code>ae_prof.sav</code>, older versions use <code>prof.sav</code>.
        Quit FTL before uploading, and make a backup of the original file.
      </p>

      {error && (
        <div className="banner danger">
          <h3>Could not read that profile</h3>
          <p>{error}</p>
        </div>
      )}

      <Dropzone
        accept=".sav"
        heading="Drop ae_prof.sav here, or click to browse"
        hint="FTL 1.5.4+ uses ae_prof.sav; FTL 1.01–1.03.3 uses prof.sav."
        disabled={busy}
        onFile={load}
      />

      <h3>Default file locations:</h3>
      <ul className="hint-list">
        <li>
          macOS:{' '}
          <code>~/Library/Application Support/FasterThanLight/ae_prof.sav</code>
        </li>
        <li>
          Windows:{' '}
          <code>%USERPROFILE%\Documents\My Games\FasterThanLight\ae_prof.sav</code>
        </li>
        <li>
          Linux: <code>~/.local/share/FasterThanLight/ae_prof.sav</code>
        </li>
      </ul>
    </div>
  )
}
