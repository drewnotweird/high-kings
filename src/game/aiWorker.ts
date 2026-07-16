// Web Worker host for the AI search. Minimax can burn its full time budget
// here without blocking the render thread.
import { getBestMove } from './ai'
import type { AiSearchParams } from './aiClient'

self.onmessage = (e: MessageEvent<AiSearchParams & { requestId: number }>) => {
  const { requestId, pieces, side, boardSize, center, difficulty, kingEscapeEdge, shieldwall, weakKing, noThrone, positionHistory } = e.data
  const move = getBestMove(pieces, side, boardSize, center, difficulty, kingEscapeEdge, shieldwall, weakKing, noThrone, positionHistory)
  self.postMessage({ requestId, move })
}
