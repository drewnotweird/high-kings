import { create } from 'zustand'
import { createInitialPieces } from '../game/hnefatafl'
import type { Piece } from '../game/hnefatafl'

export type Theme = 'longhouse' | 'clifftop' | 'hoard'

interface GameStore {
  pieces: Piece[]
  selectedId: string | null
  theme: Theme
  setTheme: (theme: Theme) => void
  selectPiece: (id: string | null) => void
}

export const useGameStore = create<GameStore>((set) => ({
  pieces: createInitialPieces(),
  selectedId: null,
  theme: 'longhouse',
  setTheme: (theme) => set({ theme }),
  selectPiece: (id) => set({ selectedId: id }),
}))
