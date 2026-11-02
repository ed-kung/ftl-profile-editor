import { useMemo } from 'react'

import type { GameData } from '../../lib/data/GameData'
import { dumpSavedGame } from '../../lib/save/dump'
import type { SavedGame } from '../../lib/save/types'

interface Props {
  data: GameData
  game: SavedGame
  fileName: string
}

export function SaveDump({ data, game, fileName }: Props) {
  const text = useMemo(
    () => dumpSavedGame(game, fileName, data.pack.source.fileName),
    [game, fileName, data],
  )

  return (
    <section className="panel">
      <h2>Dump</h2>
      <p className="panel-note">
        Everything the editor read, as text.{' '}
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(text)}
        >
          Copy to clipboard
        </button>
      </p>
      <pre className="dump">{text}</pre>
    </section>
  )
}
