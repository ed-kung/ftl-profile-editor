import { useCallback, useEffect, useMemo, useState } from 'react'

import { GameData } from '../lib/data/GameData'
import type { DataPack } from '../lib/datapack'
import { clearCachedDataPack, loadCachedDataPack } from '../lib/dataPackStore'
import { Credits, Header, ModeSwitch, type EditorMode } from './AppChrome'
import { GameDataLoader } from './GameDataLoader'
import { ProfileEditor } from './ProfileEditor'
import { SaveEditor } from './SaveEditor'

export function App() {
  const [dataPack, setDataPack] = useState<DataPack | null>(null)
  const [cacheState, setCacheState] = useState<'loading' | 'ready'>('loading')
  const [cachePersisted, setCachePersisted] = useState(true)

  const [mode, setMode] = useState<EditorMode>('profile')
  const [profileDirty, setProfileDirty] = useState(false)
  const [saveDirty, setSaveDirty] = useState(false)
  const dirty = profileDirty || saveDirty

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

  const replaceGameData = useCallback(async () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return

    await clearCachedDataPack()
    setProfileDirty(false)
    setSaveDirty(false)
    setDataPack(null)
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
        <Credits />
      </div>
    )
  }

  const modeSwitch = <ModeSwitch mode={mode} onChange={setMode} />

  // Both stay mounted, so switching doesn't lose an open file or its edits.
  return (
    <div className="app">
      <div hidden={mode !== 'profile'}>
        <ProfileEditor
          data={data}
          cachePersisted={cachePersisted}
          modeSwitch={modeSwitch}
          onReplaceGameData={replaceGameData}
          onDirtyChange={setProfileDirty}
        />
      </div>
      <div hidden={mode !== 'save'}>
        <SaveEditor
          data={data}
          cachePersisted={cachePersisted}
          modeSwitch={modeSwitch}
          onReplaceGameData={replaceGameData}
          onDirtyChange={setSaveDirty}
        />
      </div>
    </div>
  )
}
