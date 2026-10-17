import taxonomy from '@shared/taxonomy.json'
import prompts from '@shared/prompts.json'
import advisories from '@shared/advisories.json'
import helplines from '@shared/helplines.json'
import stats from '@shared/stats.json'

export { taxonomy, prompts, advisories, helplines, stats }

export type Level = 'calm' | 'caution' | 'warning' | 'stop'
export type Lang = 'en' | 'hi'
export type Profile = 'senior' | 'adult' | 'young_adult' | 'teen'

export const SIGNAL_LABEL: Record<string, string> = Object.fromEntries(
  taxonomy.signals.map((s) => [s.id, s.label]),
)
export const SCAM_LABEL: Record<string, string> = Object.fromEntries(
  taxonomy.scam_types.map((s) => [s.id, s.label]),
)
export const SIGNAL_IDS = taxonomy.signals.map((s) => s.id)
export const SCAM_IDS = taxonomy.scam_types.map((s) => s.id)

export interface Signal {
  id: string
  quote: string
  t?: number
}

export interface Alert {
  level: Level
  scam_type: string
  signals: Signal[]
  whisper_en: string
  whisper_hi: string
}

export const LEVEL_RANK: Record<Level, number> = { calm: 0, caution: 1, warning: 2, stop: 3 }

export function advisoryFor(type: string) {
  const a = (advisories as Record<string, (typeof advisories)['digital_arrest']>)[type]
  return a ?? advisories.none
}
