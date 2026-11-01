import type { GameData } from '../../lib/data/GameData'
import {
  CREW_STAT_TYPES,
  INT_STAT_TYPES,
  STAT_LABELS,
  type Profile,
} from '../../lib/profile/types'

/**
 * A plain-text view of everything the editor parsed.
 *
 * A port of net.blerf.ftl.ui.DumpPanel, which exists so a bug report can carry
 * the profile's contents without the profile itself.
 */

interface Props {
  data: GameData
  profile: Profile
  fileName: string
}

export function Dump({ data, profile, fileName }: Props) {
  const text = dumpProfile(profile, data, fileName)

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

export function dumpProfile(
  profile: Profile,
  data: GameData,
  fileName: string,
): string {
  const lines: string[] = []

  lines.push(`File:          ${fileName}`)
  lines.push(`File format:   ${profile.fileFormat} ${formatLabel(profile.fileFormat)}`)
  lines.push(`Newbie tips:   ${profile.newbieTipLevel ?? 'n/a'}`)
  lines.push(`Game data:     ${data.pack.source.fileName}`)
  lines.push('')

  lines.push('SHIP UNLOCKS')
  for (const avail of profile.shipUnlocks) {
    const ship = data.getShip(avail.shipId)
    const name = ship?.shipClass ?? ship?.name ?? avail.shipId
    lines.push(
      `  ${avail.shipId.padEnd(24)} A:${yesNo(avail.unlockedA)}  C:${yesNo(avail.unlockedC)}   ${name}`,
    )
  }
  lines.push('')

  lines.push(`ACHIEVEMENTS (${profile.achievements.length})`)
  for (const rec of profile.achievements) {
    const ach = data.getAchievement(rec.achievementId)
    let line = `  ${rec.achievementId.padEnd(32)} ${rec.difficulty.padEnd(6)}`

    if (ach?.victory) {
      line += ` A:${rec.completedWithTypeA ?? '-'} B:${rec.completedWithTypeB ?? '-'} C:${rec.completedWithTypeC ?? '-'}`
    }
    if (ach?.name) line += `   ${ach.name}`

    lines.push(line)
  }
  lines.push('')

  lines.push(`TOP SCORES (${profile.stats.topScores.length})`)
  for (const score of profile.stats.topScores) {
    lines.push(`  ${scoreLine(score)}`)
  }
  lines.push('')

  lines.push(`SHIP BEST (${profile.stats.shipBest.length})`)
  for (const score of profile.stats.shipBest) {
    lines.push(`  ${scoreLine(score)}`)
  }
  lines.push('')

  lines.push('STATS')
  for (const type of INT_STAT_TYPES) {
    lines.push(
      `  ${STAT_LABELS[type].padEnd(24)} ${profile.stats.intRecords[type]}`,
    )
  }
  lines.push('')

  lines.push('CREW RECORDS')
  for (const type of CREW_STAT_TYPES) {
    const rec = profile.stats.crewRecords[type]
    lines.push(
      `  ${STAT_LABELS[type].padEnd(24)} ${String(rec.value).padStart(6)}  ` +
        `${rec.name} (${rec.race}, ${rec.male ? 'male' : 'female'})`,
    )
  }

  return lines.join('\n')
}

function scoreLine(score: {
  shipName: string
  shipId: string
  value: number
  sector: number
  difficulty: string
  victory: boolean
  dlcEnabled: boolean
}): string {
  return (
    `${String(score.value).padStart(6)}  sector ${String(score.sector).padStart(2)}  ` +
    `${score.difficulty.padEnd(6)} ${score.victory ? 'victory' : '       '} ` +
    `${score.dlcEnabled ? 'dlc' : '   '}  ${score.shipName} [${score.shipId}]`
  )
}

function formatLabel(fileFormat: number): string {
  if (fileFormat === 4) return '(FTL 1.01-1.03.3)'
  if (fileFormat === 9) return '(FTL 1.5.4+)'
  return ''
}

function yesNo(b: boolean): string {
  return b ? 'yes' : 'no '
}
