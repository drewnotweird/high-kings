import { describe, it, expect } from 'vitest'
import { getBoardConfig, applyMove, getValidMoves } from './hnefatafl'
import type { Piece } from './hnefatafl'
import type { Rules } from '../store/gameStore'

// The engine indexes squares as `row * boardSize + col`. That encoding wraps for
// off-board columns — on 7x7, (4,-1) is index 27, which is (3,6) — so every
// capture lookup has to reject out-of-range coordinates before consulting the
// grid. These tests exist because it once didn't: an attacker could capture a
// defender pinned against the left or right edge whenever a friendly piece
// happened to stand on the wrapped square. See docs/implementation.md,
// "Square indexing".

const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]

function cfgFor(rules: string, size: number) {
  return getBoardConfig(rules as Rules, size)
}

/** Apply a move with a board config, returning the full MoveResult. */
function move(cfg: ReturnType<typeof getBoardConfig>, pieces: Piece[], id: string, row: number, col: number) {
  return applyMove(
    pieces, id, row, col,
    cfg.boardSize, cfg.center,
    cfg.kingEscapeEdge, cfg.shieldwall, cfg.weakKing, cfg.noThrone,
  )
}

const brandub = cfgFor('Brandub', 7)

describe('off-board wrap (regression)', () => {
  // The position that surfaced this: attacker slides to (4,1) against a
  // defender on the left edge at (4,0). The square beyond is (4,-1), which
  // wrapped to (3,6) — where an attacker was standing.
  it('does not capture against the left edge via a wrapped square', () => {
    const res = move(brandub, [
      { id: 'king', type: 'king', row: 3, col: 3 },
      { id: 'D', type: 'defender', row: 4, col: 0 },
      { id: 'A', type: 'attacker', row: 4, col: 3 },
      { id: 'wrap', type: 'attacker', row: 3, col: 6 }, // index 27 == (4,-1)
    ], 'A', 4, 1)
    expect(res.capturedIds).toEqual([])
  })

  it('does not capture against the right edge via a wrapped square', () => {
    const res = move(brandub, [
      { id: 'king', type: 'king', row: 3, col: 3 },
      { id: 'D', type: 'defender', row: 2, col: 6 },
      { id: 'A', type: 'attacker', row: 2, col: 3 },
      { id: 'wrap', type: 'attacker', row: 3, col: 0 }, // index 21 == (2,7)
    ], 'A', 2, 5)
    expect(res.capturedIds).toEqual([])
  })

  // Brandub's king is weak, so the sandwich test applies to it directly. This
  // was the worst case: a wrapped phantom ended the game outright.
  it('does not capture a weak king on the left edge via a wrapped square', () => {
    const res = move(brandub, [
      { id: 'king', type: 'king', row: 2, col: 0 },
      { id: 'A', type: 'attacker', row: 2, col: 4 },
      { id: 'wrap', type: 'attacker', row: 1, col: 6 }, // index 13 == (2,-1)
    ], 'A', 2, 1)
    expect(res.winner).toBeNull()
  })

  it('does not capture a weak king on the right edge via a wrapped square', () => {
    const res = move(brandub, [
      { id: 'king', type: 'king', row: 4, col: 6 },
      { id: 'A', type: 'attacker', row: 4, col: 2 },
      { id: 'wrap', type: 'attacker', row: 5, col: 0 }, // index 35 == (4,7)
    ], 'A', 4, 5)
    expect(res.winner).toBeNull()
  })

  it('never captures a piece pinned against an edge with nothing beyond it', () => {
    // All four edges, no third piece anywhere.
    const cases: [number, number, number, number][] = [
      [0, 3, 1, 3], // top
      [6, 3, 5, 3], // bottom
      [3, 0, 3, 1], // left
      [3, 6, 3, 5], // right
    ]
    for (const [vr, vc, mr, mc] of cases) {
      const res = move(brandub, [
        { id: 'king', type: 'king', row: 3, col: 3 },
        { id: 'D', type: 'defender', row: vr, col: vc },
        { id: 'A', type: 'attacker', row: mr === 3 ? mr : 4, col: mc === 3 ? 5 : mc },
      ], 'A', mr, mc)
      expect(res.capturedIds, `victim (${vr},${vc})`).toEqual([])
    }
  })
})

describe('legitimate captures still fire', () => {
  it('captures by sandwich along an edge', () => {
    const res = move(brandub, [
      { id: 'king', type: 'king', row: 3, col: 3 },
      { id: 'D', type: 'defender', row: 0, col: 3 },
      { id: 'A1', type: 'attacker', row: 0, col: 2 },
      { id: 'A2', type: 'attacker', row: 4, col: 4 },
    ], 'A2', 0, 4)
    expect(res.capturedIds).toContain('D')
  })

  it('treats an empty corner as a captor', () => {
    const res = move(brandub, [
      { id: 'king', type: 'king', row: 3, col: 3 },
      { id: 'D', type: 'defender', row: 0, col: 1 },
      { id: 'A', type: 'attacker', row: 4, col: 2 },
    ], 'A', 0, 2)
    expect(res.capturedIds).toContain('D')
  })

  it('captures mid-board by ordinary sandwich', () => {
    const res = move(brandub, [
      { id: 'king', type: 'king', row: 3, col: 3 },
      { id: 'D', type: 'defender', row: 3, col: 2 },
      { id: 'A1', type: 'attacker', row: 2, col: 2 },
      { id: 'A2', type: 'attacker', row: 5, col: 5 },
    ], 'A2', 4, 2)
    expect(res.capturedIds).toContain('D')
  })

  it('captures a weak king by ordinary sandwich', () => {
    const res = move(brandub, [
      { id: 'king', type: 'king', row: 2, col: 2 },
      { id: 'A1', type: 'attacker', row: 2, col: 1 },
      { id: 'A2', type: 'attacker', row: 5, col: 3 },
    ], 'A2', 2, 3)
    expect(res.winner).toBe('attacker')
    expect(res.winReason).toBe('king-captured')
  })

  it('captures a weak king against an empty corner', () => {
    const res = move(brandub, [
      { id: 'king', type: 'king', row: 0, col: 1 },
      { id: 'A', type: 'attacker', row: 4, col: 2 },
    ], 'A', 0, 2)
    expect(res.winner).toBe('attacker')
  })
})

describe('capture geometry matches the rules across variants', () => {
  // Exhaustive sweep: put a victim on every square, bring an attacker in from
  // each direction, and park one spare attacker on every other square in turn.
  // A capture must happen exactly when the square beyond the victim is on the
  // board AND is either hostile or holds the spare. Any disagreement means a
  // coordinate escaped its bounds check.
  //
  // This reports 5 mismatches against the pre-fix engine and 0 against the
  // current one.
  const variants: [string, number][] = [
    ['Brandub', 7],
    ['Ard Rí', 7],
    ['Linnaeus Tablut', 9],
    ['Copenhagen', 11],
    ['Historical', 11],
    ['Tyr', 15],
    ['Alea Evangelii', 19],
  ]

  for (const [rules, size] of variants) {
    it(`${rules} ${size}x${size}`, () => {
      const cfg = cfgFor(rules, size)
      const N = cfg.boardSize, C = cfg.center
      const inBounds = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N
      const isCorner = (r: number, c: number) => (r === 0 || r === N - 1) && (c === 0 || c === N - 1)
      const blocked = (r: number, c: number) => isCorner(r, c) || (r === C && c === C)

      const mismatches: string[] = []
      let checks = 0

      for (let vr = 0; vr < N; vr++) for (let vc = 0; vc < N; vc++) {
        if (blocked(vr, vc)) continue
        for (const [dr, dc] of DIRS) {
          const mr = vr - dr, mc = vc - dc     // where the attacker lands
          const br = vr + dr, bc = vc + dc     // the square beyond the victim
          const sr0 = mr - dr, sc0 = mc - dc   // where it starts, so it can slide in
          if (!inBounds(mr, mc) || blocked(mr, mc)) continue
          if (!inBounds(sr0, sc0) || blocked(sr0, sc0)) continue
          if (sr0 === vr && sc0 === vc) continue

          for (let sr = 0; sr < N; sr++) for (let sc = 0; sc < N; sc++) {
            if (blocked(sr, sc)) continue
            if ((sr === vr && sc === vc) || (sr === mr && sc === mc) || (sr === sr0 && sc === sc0)) continue

            const pieces: Piece[] = [
              { id: 'king', type: 'king', row: C, col: C },
              { id: 'V', type: 'defender', row: vr, col: vc },
              { id: 'M', type: 'attacker', row: sr0, col: sc0 },
              { id: 'S', type: 'attacker', row: sr, col: sc },
            ]
            const occupied = new Set(pieces.map(p => `${p.row},${p.col}`))
            const beyondHostile = inBounds(br, bc)
              && (isCorner(br, bc) || (!cfg.noThrone && br === C && bc === C && !occupied.has(`${br},${bc}`)))
            const expected = beyondHostile || (inBounds(br, bc) && br === sr && bc === sc)

            const got = move(cfg, pieces, 'M', mr, mc).capturedIds.includes('V')
            checks++
            if (got !== expected && mismatches.length < 5) {
              mismatches.push(
                `victim(${vr},${vc}) mover->(${mr},${mc}) spare(${sr},${sc}) ` +
                `beyond(${br},${bc}) expected=${expected} got=${got}`,
              )
            }
          }
        }
      }
      // Guards against a future refactor quietly skipping the loop: the real
      // counts run from 4,592 (7x7) to 446,192 (19x19), 718,080 in total.
      expect(checks).toBeGreaterThan(N * N * N)
      expect(mismatches).toEqual([])
    })
  }
})

describe('movement stays on the board', () => {
  it('never returns an off-board destination, for any piece on any variant', () => {
    for (const [rules, size] of [['Brandub', 7], ['Copenhagen', 11], ['Alea Evangelii', 19]] as const) {
      const cfg = cfgFor(rules, size)
      const N = cfg.boardSize
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const piece: Piece = { id: 'P', type: 'defender', row: r, col: c }
        const moves = getValidMoves(piece, [piece], N, cfg.center, cfg.noThrone)
        for (const [mr, mc] of moves) {
          expect(mr >= 0 && mr < N && mc >= 0 && mc < N, `${rules} (${r},${c}) -> (${mr},${mc})`).toBe(true)
        }
      }
    }
  })
})
