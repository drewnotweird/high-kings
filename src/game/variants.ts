import { getBoardConfig } from './hnefatafl'
import type { Rules } from '../store/gameStore'

export const BOARD_SIZE_RULES: Record<number, Rules[]> = {
  7:  ['Brandub', 'Ard Rí'],
  9:  ['Linnaeus Tablut', 'Saami Tablut'],
  11: ['Copenhagen', 'Fetlar', 'Historical', 'Tawlbwrdd', 'Simple Tyr'],
  13: ['Copenhagen', 'Fetlar', 'Historical'],
  15: ['Tyr'],
  17: [],
  19: ['Alea Evangelii'],
}

export const ALL_RULES: Rules[] = ['Copenhagen', 'Fetlar', 'Historical', 'Tawlbwrdd', 'Simple Tyr', 'Linnaeus Tablut', 'Saami Tablut', 'Brandub', 'Ard Rí', 'Tyr', 'Alea Evangelii']
export const ALL_BOARD_SIZES = [7, 9, 11, 13, 15, 17, 19].filter(n => (BOARD_SIZE_RULES[n] ?? []).length > 0)

// URL slug for a variant: "Ard Rí" -> "ard-ri" (used by ?rules= deep links)
export function variantSlug(rules: Rules): string {
  return rules.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-')
}

export function rulesFromSlug(slug: string): Rules | null {
  const norm = slug.trim().toLowerCase().replace(/\s+/g, '-')
  return ALL_RULES.find(r => variantSlug(r) === norm) ?? null
}

// Smallest board size that supports the given rules
export function defaultSizeFor(rules: Rules): number {
  for (const size of ALL_BOARD_SIZES) {
    if ((BOARD_SIZE_RULES[size] ?? []).includes(rules)) return size
  }
  return 11
}


// --- Setup-screen metadata -------------------------------------------------

// A one-line character sketch per variant. Facts (king strength, escape type…)
// are derived from the board config below rather than repeated here, so they
// can never drift from the actual rules.
export const VARIANT_BLURB: Record<Rules, string> = {
  'Copenhagen': 'The modern tournament standard.',
  'Fetlar': 'Copenhagen without shieldwalls — captures come one at a time.',
  'Historical': 'Reconstructed from period sources. The King is vulnerable once he leaves the throne.',
  'Tawlbwrdd': 'The Welsh board. The King runs for any edge, not just the corners.',
  'Simple Tyr': 'Tyr rules at a friendlier size — a good way in to the family.',
  'Linnaeus Tablut': 'Recorded in Lapland in 1732. Fast and aggressive.',
  'Saami Tablut': 'Tablut with a wider defensive diamond, for a more open opening.',
  'Brandub': 'A tiny, sharp Irish duel where every move counts.',
  'Ard Rí': 'The Irish High King — a dense brawl on the smallest board.',
  'Tyr': 'The largest competitive board, with no throne to lean on.',
  'Alea Evangelii': 'An epic reconstruction from a 10th-century manuscript.',
}

export interface VariantFacts {
  king: string
  escape: string
  extras: string[]
  attackers: number
  defenders: number
}

// Reads the real board config so the setup screen always describes what the
// engine will actually play.
export function variantFacts(rules: Rules, boardSize: number): VariantFacts {
  const c = getBoardConfig(rules, boardSize)
  const extras: string[] = []
  if (c.shieldwall) extras.push('Shieldwall')
  if (c.noThrone) extras.push('No throne')
  if (c.attackerFirst) extras.push('Attackers move first')
  return {
    king: c.weakKing ? 'Weak King' : 'Strong King',
    escape: c.kingEscapeEdge ? 'Edge escape' : 'Corner escape',
    extras,
    attackers: c.attackerStarts.length,
    defenders: c.defenderStarts.length,
  }
}
