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

