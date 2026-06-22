import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../../store/gameStore'
import { BOARD_SIZE, isCorner, isThrone } from '../../game/hnefatafl'

const CELL = 40
const PAD = 24
const TOTAL = BOARD_SIZE * CELL + PAD * 2

const BOARD_ARRIVE = 1.2
const PIECE_STAGGER = 0.035

function cx(col: number) { return PAD + col * CELL }
function cy(row: number) { return PAD + row * CELL }
function pcx(col: number) { return PAD + col * CELL + CELL / 2 }
function pcy(row: number) { return PAD + row * CELL + CELL / 2 }

const ATTACKER_FILL    = '#3a5a9a'
const ATTACKER_STROKE  = '#6a90d8'
const DEFENDER_FILL    = '#c0b890'
const DEFENDER_STROKE  = '#e0d8c0'
const KING_FILL        = '#d4a820'
const KING_STROKE      = '#f0d060'
const SELECTED_GLOW    = 'rgba(255,220,60,0.85)'

export function Board2D({ menuOpen }: { menuOpen: boolean }) {
  const { pieces, selectedId, selectPiece, gameKey } = useGameStore()
  const [mounted, setMounted] = useState(false)
  const [visibleCount, setVisibleCount] = useState(pieces.length) // start fully visible (mid-game switch)
  const prevGameKey = useRef(gameKey)

  // Board fade-in
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(t)
  }, [])

  // Sequential piece reveal — only when gameKey increments (actual new game)
  useEffect(() => {
    if (gameKey === prevGameKey.current) return
    prevGameKey.current = gameKey

    const ordered = [
      ...pieces.filter(p => p.type === 'king'),
      ...pieces.filter(p => p.type === 'defender'),
      ...pieces.filter(p => p.type === 'attacker'),
    ]

    setVisibleCount(0)
    const timers: ReturnType<typeof setTimeout>[] = []
    ordered.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleCount(i + 1), (BOARD_ARRIVE + i * PIECE_STAGGER) * 1000))
    })

    return () => timers.forEach(clearTimeout)
  }, [gameKey])

  const ordered = [
    ...pieces.filter(p => p.type === 'king'),
    ...pieces.filter(p => p.type === 'defender'),
    ...pieces.filter(p => p.type === 'attacker'),
  ]
  const orderMap = new Map(ordered.map((p, i) => [p.id, i]))

  return (
    <div
      className="board2d"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: menuOpen ? 0 : mounted ? 1 : 0,
        transition: 'opacity 0.5s ease',
        pointerEvents: menuOpen ? 'none' : undefined,
      }}
    >
      <svg
        className="board2d__svg"
        viewBox={`0 0 ${TOTAL} ${TOTAL}`}
        style={{
          width: 'min(100vw, calc(100vh - 280px))',
          height: 'min(100vw, calc(100vh - 280px))',
          maxWidth: 'calc(100vh - 280px)',
          maxHeight: 'calc(100vh - 280px)',
          marginTop: 30,
          flexShrink: 0,
          display: 'block',
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Board background */}
        <rect
          className="board2d__bg"
          x={PAD - 4} y={PAD - 4}
          width={BOARD_SIZE * CELL + 8}
          height={BOARD_SIZE * CELL + 8}
          rx={6}
          fill="#1a1608"
          stroke="rgba(180,140,60,0.5)"
          strokeWidth={1.5}
        />

        {/* Cells */}
        {Array.from({ length: BOARD_SIZE }, (_, row) =>
          Array.from({ length: BOARD_SIZE }, (_, col) => {
            const corner = isCorner(row, col)
            const throne = isThrone(row, col)
            const fill = corner ? '#2c2210'
              : throne ? '#332a12'
              : (row + col) % 2 === 0 ? '#1e1a0e' : '#1a160b'
            return (
              <rect
                key={`${row}-${col}`}
                className={`board2d__cell${corner ? ' board2d__cell--corner' : ''}${throne ? ' board2d__cell--throne' : ''}`}
                x={cx(col)} y={cy(row)}
                width={CELL} height={CELL}
                fill={fill}
              />
            )
          })
        )}

        {/* Grid lines */}
        {Array.from({ length: BOARD_SIZE + 1 }, (_, i) => (
          <g key={i}>
            <line
              x1={PAD} y1={PAD + i * CELL}
              x2={PAD + BOARD_SIZE * CELL} y2={PAD + i * CELL}
              stroke="rgba(180,140,60,0.14)" strokeWidth={0.5}
            />
            <line
              x1={PAD + i * CELL} y1={PAD}
              x2={PAD + i * CELL} y2={PAD + BOARD_SIZE * CELL}
              stroke="rgba(180,140,60,0.14)" strokeWidth={0.5}
            />
          </g>
        ))}

        {/* Corner markers */}
        {([[0,0],[0,10],[10,0],[10,10]] as [number,number][]).map(([r,c]) => (
          <rect
            key={`corner-${r}-${c}`}
            className="board2d__corner-marker"
            x={cx(c) + 5} y={cy(r) + 5}
            width={CELL - 10} height={CELL - 10}
            rx={3}
            fill="none"
            stroke="rgba(180,140,60,0.55)"
            strokeWidth={1.2}
          />
        ))}

        {/* Throne marker */}
        <rect
          className="board2d__throne-marker"
          x={cx(5) + 5} y={cy(5) + 5}
          width={CELL - 10} height={CELL - 10}
          rx={3}
          fill="none"
          stroke="rgba(180,140,60,0.45)"
          strokeWidth={1.2}
        />

        {/* Pieces */}
        {pieces.map(piece => {
          const x = pcx(piece.col)
          const y = pcy(piece.row)
          const selected = selectedId === piece.id
          const isKing = piece.type === 'king'
          const isDefender = piece.type === 'defender'
          const pieceIndex = orderMap.get(piece.id) ?? 0
          const visible = pieceIndex < visibleCount

          const fill = isKing ? KING_FILL : isDefender ? DEFENDER_FILL : ATTACKER_FILL
          const stroke = isKing ? KING_STROKE : isDefender ? DEFENDER_STROKE : ATTACKER_STROKE
          const r = isKing ? 15 : 13

          return (
            <g
              key={piece.id}
              className={`board2d__piece board2d__piece--${piece.type}${selected ? ' board2d__piece--selected' : ''}`}
              onClick={() => selectPiece(selectedId === piece.id ? null : piece.id)}
              style={{
                cursor: 'pointer',
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
            >
              {selected && (
                <circle cx={x} cy={y} r={r + 5} fill={SELECTED_GLOW} opacity={0.35} />
              )}
              <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />
              {isKing && (
                <circle cx={x} cy={y} r={4} fill={KING_STROKE} opacity={0.9} />
              )}
              {selected && (
                <circle cx={x} cy={y} r={r + 2} fill="none" stroke={SELECTED_GLOW} strokeWidth={1.5} />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
