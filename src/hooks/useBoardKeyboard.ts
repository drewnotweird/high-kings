import { useGameSlice } from '../store/gameStore'
import { getBoardConfig } from '../game/hnefatafl'
import { describeSquare, squareName } from '../game/notation'

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
}

// Keyboard play for the board. It's a canvas (or an SVG in power-saving mode),
// so it can't be navigated natively — a cursor lives in the store, this drives
// it, and the strings below feed aria-live regions.
//
// Everything here is derived during render rather than pushed from effects: the
// live region announces whatever changes, so there's nothing to store.
export function useBoardKeyboard(enabled: boolean) {
  const { cursor, pieces, validMoves, selectedId, currentTurn, winner, winReason,
          rules, boardSize: storedSize, lastMoveText, moveCursor, activateCursor, selectPiece } =
    useGameSlice('cursor', 'pieces', 'validMoves', 'selectedId', 'currentTurn', 'winner', 'winReason',
                 'rules', 'boardSize', 'lastMoveText', 'moveCursor', 'activateCursor', 'selectPiece')

  const { boardSize, center, kingEscapeEdge } = getBoardConfig(rules, storedSize)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!enabled) return
    const delta = ARROWS[e.key]
    if (delta) {
      e.preventDefault()
      // Shift+arrow jumps to the board edge
      const jump = e.shiftKey ? boardSize : 1
      moveCursor(delta[0] * jump, delta[1] * jump)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateCursor(); return }
    if (e.key === 'Escape' && selectedId) { e.preventDefault(); selectPiece(null) }
  }

  const selected = selectedId ? pieces.find(p => p.id === selectedId) : undefined

  // What the cursor is sitting on, or what's currently picked up
  const status = !enabled ? ''
    : selected
      ? `Holding ${selected.type === 'king' ? 'King' : selected.type} from ${squareName(selected.row, selected.col, boardSize)}, ${validMoves.length} moves. `
        + describeSquare(cursor.row, cursor.col, pieces, boardSize, center, {
            isValidTarget: validMoves.some(([r, c]) => r === cursor.row && c === cursor.col),
            kingEscapeEdge,
          })
      : describeSquare(cursor.row, cursor.col, pieces, boardSize, center, { kingEscapeEdge })

  const outcome = !winner ? '' : (() => {
    const why = winReason === 'king-escaped' ? 'the King reached safety'
      : winReason === 'king-captured' ? 'the King was captured'
      : winReason === 'attackers-eliminated' ? 'every attacker was eliminated'
      : winReason === 'stalemate' ? 'no legal moves remained'
      : winReason === 'repetition' ? 'the position repeated three times' : ''
    return `Game over. ${winner === 'defender' ? 'Defenders' : 'Attackers'} win${why ? ' — ' + why : ''}.`
  })()

  const turnLabel = winner ? 'Game over' : `${currentTurn === 'defender' ? 'Defenders' : 'Attackers'} to move`

  return { onKeyDown, status, moveText: outcome || lastMoveText, turnLabel }
}
