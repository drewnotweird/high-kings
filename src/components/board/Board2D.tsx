import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../../store/gameStore'
import { getBoardConfig, isCorner, isThrone } from '../../game/hnefatafl'
import type { PieceType } from '../../game/hnefatafl'

const CELL = 40
const PAD = 24

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

function pieceColor(type: PieceType) {
  if (type === 'king') return KING_FILL
  if (type === 'defender') return DEFENDER_FILL
  return ATTACKER_FILL
}

interface DyingPiece {
  key: number
  x: number
  y: number
  fill: string
  particles: { dx: number; dy: number }[]
}

const BURST_CSS = `
@keyframes board2d-particle {
  0%   { transform: translate(0px, 0px); opacity: 0.85; }
  100% { transform: translate(var(--pdx), var(--pdy)); opacity: 0; }
}
`

export function Board2D({ menuOpen }: { menuOpen: boolean }) {
  const { pieces, dyingPieces: storeDyingPieces, clearDyingPieces, selectedId, selectPiece, movePiece, validMoves, gameKey, rules, boardSize: storedBoardSize, roleSelectOpen } = useGameStore()
  const { boardSize, center } = getBoardConfig(rules, storedBoardSize)
  const TOTAL = boardSize * CELL + PAD * 2

  const [mounted, setMounted] = useState(false)
  const [visibleCount, setVisibleCount] = useState(pieces.length) // start fully visible (mid-game switch)
  const prevGameKey = useRef(gameKey)

  // Dying piece burst animations — driven by store dyingPieces
  const [dyingPieces, setDyingPieces] = useState<DyingPiece[]>([])

  useEffect(() => {
    if (storeDyingPieces.length === 0) return
    setDyingPieces(prev => [
      ...prev,
      ...storeDyingPieces.map(p => ({
        key: Date.now() + Math.random() * 1000,
        x: pcx(p.col),
        y: pcy(p.row),
        fill: pieceColor(p.type),
        particles: Array.from({ length: 8 }, (_, i) => {
          const angle = (i / 8) * Math.PI * 2 + 0.4
          const dist = 14 + (i % 3) * 6
          return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist }
        }),
      })),
    ])
    // Remove captured pieces from the store immediately (no 3D arrival delay in 2D mode)
    clearDyingPieces()
  }, [storeDyingPieces])

  // Board fade-in
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(t)
  }, [])

  // Sequential piece reveal — only when gameKey increments (actual new game)
  useEffect(() => {
    if (gameKey === prevGameKey.current) return
    prevGameKey.current = gameKey
    setDyingPieces([])

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

  const last = boardSize - 1
  const corners: [number, number][] = [[0,0],[0,last],[last,0],[last,last]]

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
      <style>{BURST_CSS}</style>
      <svg
        className="board2d__svg"
        viewBox={`0 0 ${TOTAL} ${TOTAL}`}
        onClick={() => { if (selectedId) selectPiece(null) }}
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
          width={boardSize * CELL + 8}
          height={boardSize * CELL + 8}
          rx={6}
          fill="#1a1608"
          stroke="rgba(180,140,60,0.5)"
          strokeWidth={1.5}
        />

        {/* Cells */}
        {Array.from({ length: boardSize }, (_, row) =>
          Array.from({ length: boardSize }, (_, col) => {
            const corner = isCorner(row, col, boardSize)
            const throne = isThrone(row, col, center)
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
        {Array.from({ length: boardSize + 1 }, (_, i) => (
          <g key={i}>
            <line
              x1={PAD} y1={PAD + i * CELL}
              x2={PAD + boardSize * CELL} y2={PAD + i * CELL}
              stroke="rgba(180,140,60,0.14)" strokeWidth={0.5}
            />
            <line
              x1={PAD + i * CELL} y1={PAD}
              x2={PAD + i * CELL} y2={PAD + boardSize * CELL}
              stroke="rgba(180,140,60,0.14)" strokeWidth={0.5}
            />
          </g>
        ))}

        {/* Corner markers */}
        {corners.map(([r, c]) => (
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
          x={cx(center) + 5} y={cy(center) + 5}
          width={CELL - 10} height={CELL - 10}
          rx={3}
          fill="none"
          stroke="rgba(180,140,60,0.45)"
          strokeWidth={1.2}
        />

        {/* Valid move targets */}
        {validMoves.map(([r, c]) => (
          <g
            key={`vm-${r}-${c}`}
            className="board2d__valid-move"
            onClick={(e) => { e.stopPropagation(); movePiece(r, c) }}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x={cx(c)} y={cy(r)}
              width={CELL} height={CELL}
              fill="rgba(255,102,0,0.18)"
            />
            <circle
              cx={pcx(c)} cy={pcy(r)}
              r={9}
              fill="rgba(255,102,0,0.75)"
            />
          </g>
        ))}

        {/* Pieces — hidden during role select, animate in after side is chosen */}
        {!roleSelectOpen && pieces.map(piece => {
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
              onClick={(e) => { e.stopPropagation(); selectPiece(selectedId === piece.id ? null : piece.id) }}
              style={{
                cursor: 'pointer',
                opacity: visible ? 1 : 0,
                transform: `translate(${pcx(piece.col)}px, ${pcy(piece.row)}px)`,
                transition: 'opacity 0.3s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {selected && (
                <circle cx={0} cy={0} r={r + 5} fill={SELECTED_GLOW} opacity={0.35} />
              )}
              <circle cx={0} cy={0} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />
              {isKing && (
                <circle cx={0} cy={0} r={4} fill={KING_STROKE} opacity={0.9} />
              )}
              {selected && (
                <circle cx={0} cy={0} r={r + 2} fill="none" stroke={SELECTED_GLOW} strokeWidth={1.5} />
              )}
            </g>
          )
        })}

        {/* Capture burst particles */}
        {dyingPieces.flatMap(dp =>
          dp.particles.map((p, i) => (
            <circle
              key={`${dp.key}-${i}`}
              cx={dp.x}
              cy={dp.y}
              r={3.5}
              fill={dp.fill}
              style={{
                ['--pdx' as string]: `${p.dx}px`,
                ['--pdy' as string]: `${p.dy}px`,
                animation: `board2d-particle 0.45s ease-out ${i * 0.015}s forwards`,
                pointerEvents: 'none',
              } as React.CSSProperties}
              onAnimationEnd={i === dp.particles.length - 1
                ? () => setDyingPieces(prev => prev.filter(d => d.key !== dp.key))
                : undefined}
            />
          ))
        )}
      </svg>
    </div>
  )
}
