import { SAVE_FORMAT_LABELS, type SavedGame } from './types'

/**
 * A plain-text view of everything the parser read.
 *
 * Plays the part of SavedGameState.toString(), so a bug report can carry a
 * save's contents, and the two editors' readings can be compared.
 */

function printValue(value: unknown, indent: string, lines: string[], label: string): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${indent}${label}: (none)`)
      return
    }

    if (value.every((item) => typeof item !== 'object' || item === null)) {
      lines.push(`${indent}${label}: ${value.join(', ')}`)
      return
    }

    lines.push(`${indent}${label} (${value.length}):`)
    value.forEach((item, i) => printValue(item, `${indent}  `, lines, `[${i}]`))
    return
  }

  if (typeof value === 'object' && value !== null) {
    lines.push(`${indent}${label}:`)
    for (const [key, child] of Object.entries(value)) {
      printValue(child, `${indent}  `, lines, key)
    }
    return
  }

  lines.push(`${indent}${label}: ${value === null ? '(none)' : String(value)}`)
}

export function dumpSavedGame(game: SavedGame, fileName: string, gameData: string): string {
  const lines = [
    `File:        ${fileName}`,
    `File format: ${game.fileFormat} (${SAVE_FORMAT_LABELS[game.fileFormat] ?? 'unknown'})`,
    `Game data:   ${gameData}`,
    '',
  ]

  for (const [key, value] of Object.entries(game)) {
    printValue(value, '', lines, key)
  }

  return lines.join('\n')
}
