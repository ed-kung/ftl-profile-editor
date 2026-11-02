import type { ReactNode } from 'react'

import type { GameData } from '../lib/data/GameData'

export type EditorMode = 'profile' | 'save'

interface ModeSwitchProps {
  mode: EditorMode
  onChange: (mode: EditorMode) => void
}

/** Chooses between the two editors, as the Java app's top-level tabs do. */
export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  const option = (value: EditorMode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => onChange(value)}
    >
      {label}
    </button>
  )

  return (
    <div className="tabs mode-switch" role="tablist" aria-label="Editor">
      {option('profile', 'Profile')}
      {option('save', 'Saved Game')}
    </div>
  )
}

interface HeaderProps {
  data?: GameData
  /** E.g. "Profile: ae_prof.sav (FTL 1.5.4+)". */
  fileLabel?: string
  dirty?: boolean
  saveDisabledReason?: string | null
  onSave?: () => void
  onBackup?: () => void
  onClose?: () => void
  onReplaceGameData?: () => void
  modeSwitch?: ReactNode
}

export function Header({
  data,
  fileLabel,
  dirty,
  saveDisabledReason,
  onSave,
  onBackup,
  onClose,
  onReplaceGameData,
  modeSwitch,
}: HeaderProps) {
  return (
    <>
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
            {fileLabel && (
              <span>
                {fileLabel}
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
              disabled={Boolean(saveDisabledReason)}
              onClick={onSave}
              title={saveDisabledReason ?? undefined}
            >
              Save
            </button>
          </div>
        )}
      </header>
      {modeSwitch}
    </>
  )
}

export function Credits() {
  return (
    <footer className="credits">
      <p>
        Browser based version of{' '}
        <a href="https://github.com/Vhati/ftl-profile-editor" target="_blank" rel="noreferrer">
          Vhati&rsquo;s FTL Profile Editor
        </a>
        .
      </p>
      <p>
        <a href="https://github.com/ed-kung/ftl-profile-editor" target="_blank" rel="noreferrer">
          Source for this project on GitHub
        </a>
      </p>
    </footer>
  )
}
