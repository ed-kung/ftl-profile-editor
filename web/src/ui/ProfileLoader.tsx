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
      <h2>Open your profile</h2>
      <p>
        Quit FTL before editing, and keep a copy of the original — the editor
        offers you one as soon as the file opens.
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
        <li>
          Looking for <code>continue.sav</code>? Saved-game editing isn't
          supported here yet — use the desktop app for that.
        </li>
      </ul>
    </div>
  )
}
