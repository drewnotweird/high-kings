import { useMemo, useRef, useEffect, useLayoutEffect, useState } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { ClampToEdgeWrapping, Shape, ExtrudeGeometry, Vector2, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { getBoardConfig, isCorner, isThrone, isValidMove } from '../../game/hnefatafl'
import { useGameStore } from '../../store/gameStore'
import type { ThemeConfig } from '../../lib/themes'

const SQUARE_SIZE = 0.88
const TILE_HEIGHT = 0.055
const CORNER_RADIUS = 0.05
const BEVEL = 0.038
const TILE_TOP = TILE_HEIGHT + BEVEL
const TILE_COUNT = 10
const HALF = SQUARE_SIZE / 2

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Custom UV generator so tile texture is centred and fills the top face 0→1
const uvGenerator = {
  generateTopUV(_: unknown, vertices: number[], iA: number, iB: number, iC: number) {
    const toUV = (x: number, y: number) =>
      new Vector2((x + HALF) / SQUARE_SIZE, (y + HALF) / SQUARE_SIZE)
    return [
      toUV(vertices[iA * 3], vertices[iA * 3 + 1]),
      toUV(vertices[iB * 3], vertices[iB * 3 + 1]),
      toUV(vertices[iC * 3], vertices[iC * 3 + 1]),
    ]
  },
  generateSideWallUV(_: unknown, vertices: number[], iA: number, iB: number, iC: number, iD: number) {
    const az = vertices[iA * 3 + 2], bz = vertices[iB * 3 + 2]
    const cz = vertices[iC * 3 + 2], dz = vertices[iD * 3 + 2]
    const ax = vertices[iA * 3],     bx = vertices[iB * 3]
    const cx = vertices[iC * 3],     dx = vertices[iD * 3]
    return [
      new Vector2(ax, az / TILE_HEIGHT),
      new Vector2(bx, bz / TILE_HEIGHT),
      new Vector2(cx, cz / TILE_HEIGHT),
      new Vector2(dx, dz / TILE_HEIGHT),
    ]
  },
}

interface BoardProps {
  theme: ThemeConfig
}

const phaseCache = new Map<string, number>()
export function clearPhaseCache() { phaseCache.clear() }
function getPhase(row: number, col: number) {
  const key = `${row},${col}`
  if (!phaseCache.has(key)) phaseCache.set(key, Math.random() * Math.PI * 2)
  return phaseCache.get(key)!
}

function ValidMoveMarker({ x, z, row, col, appearDelay, disappearing = false, disappearDelay = 0 }: {
  x: number; z: number; row: number; col: number; appearDelay: number
  disappearing?: boolean; disappearDelay?: number
}) {
  const meshRef = useRef<Mesh>(null)
  const glowRef = useRef<Mesh>(null)
  const matRef = useRef<MeshStandardMaterial>(null)
  const { movePiece, powerSaving } = useGameStore()
  const phase = getPhase(row, col)
  const birthTime = useRef(0)
  const { clock } = useThree()
  useEffect(() => { birthTime.current = clock.getElapsedTime() }, [])
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime()
    const elapsed = t - birthTime.current

    if (disappearing) {
      // Hold at full scale until disappearDelay, then shrink over 120ms
      const s = elapsed < disappearDelay ? 1 : Math.max(0, 1 - Math.min((elapsed - disappearDelay) / 0.12, 1))
      meshRef.current.scale.setScalar(s)
      if (glowRef.current) glowRef.current.scale.setScalar(s)
    } else {
      if (elapsed < appearDelay) {
        meshRef.current.scale.setScalar(0)
        if (glowRef.current) glowRef.current.scale.setScalar(0)
        return
      }
      // Quick elastic pop-in over 120ms
      const p = Math.min((elapsed - appearDelay) / 0.12, 1)
      const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p
      const overshoot = p >= 1 ? 1 : ease * 1.25 - 0.25 * ease * ease
      const s = Math.max(0, Math.min(overshoot, 1.15 - 0.15 * p))
      meshRef.current.scale.setScalar(s)
      if (glowRef.current) glowRef.current.scale.setScalar(s)
    }

    if (powerSaving) return

    // Bob gently — keep glow concentric with orb
    const bobY = TILE_TOP + 0.18 + Math.sin(t * 2.6 + phase) * 0.04
    meshRef.current.position.y = bobY
    if (glowRef.current) glowRef.current.position.y = bobY

    // Flicker emissive intensity
    if (matRef.current) {
      const flicker = 0.55 + 0.45 * Math.sin(t * 13.1 + phase * 3.7) * Math.sin(t * 8.3 + phase)
      matRef.current.emissiveIntensity = 0.35 + flicker * 0.3
    }
  })

  return (
    <group position={[x, TILE_TOP + 0.18, z]}>
      <mesh
        ref={meshRef}
        castShadow
        scale={0}
        onClick={disappearing ? undefined : (e) => { e.stopPropagation(); movePiece(row, col) }}
      >
        <sphereGeometry args={[0.13, 14, 10]} />
        <meshStandardMaterial
          ref={matRef}
          color={powerSaving ? "#ff6600" : "#e8874a"}
          emissive={powerSaving ? "#ff4400" : "#d45a10"}
          emissiveIntensity={powerSaving ? 0.9 : 0.4}
          roughness={0.9}
          metalness={0}
          transparent
          opacity={0.85}
        />
      </mesh>
      {!powerSaving && (
        <mesh ref={glowRef} scale={0}>
          <sphereGeometry args={[0.26, 10, 8]} />
          <meshStandardMaterial
            color="#ff4400"
            emissive="#ff4400"
            emissiveIntensity={0.6}
            transparent
            opacity={0.12}
            depthWrite={false}
            side={2}
          />
        </mesh>
      )}
    </group>
  )
}

const hoverPlaneGeo = new PlaneGeometry(SQUARE_SIZE * 0.94, SQUARE_SIZE * 0.94)

function TileHoverGlow({ x, z, active }: { x: number; z: number; active: boolean }) {
  const meshRef = useRef<Mesh>(null)
  const matRef = useRef<MeshStandardMaterial>(null)
  const opRef = useRef(0)
  const posX = useRef(x)
  const posZ = useRef(z)

  useEffect(() => { posX.current = x; posZ.current = z }, [x, z])

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return
    meshRef.current.position.x = posX.current
    meshRef.current.position.z = posZ.current
    const target = active ? 0.45 : 0
    opRef.current += (target - opRef.current) * Math.min(delta * 16, 1)
    matRef.current.opacity = opRef.current
    meshRef.current.visible = opRef.current > 0.005
  })

  return (
    <mesh
      ref={meshRef}
      position={[x, TILE_TOP + 0.003, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={hoverPlaneGeo}
      visible={false}
    >
      <meshStandardMaterial
        ref={matRef}
        color="#ffe090"
        emissive="#ffbb30"
        emissiveIntensity={1.4}
        transparent
        opacity={0}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  )
}

export function Board({ theme }: BoardProps) {
  const { rules, pieces, validMoves, selectedId, selectPiece, movePiece, gameKey, powerSaving } = useGameStore()
  const { boardSize, center, attackerStarts, defenderStarts, kingEscapeEdge } = getBoardConfig(rules)
  useEffect(() => { clearPhaseCache() }, [gameKey])
  const [hoveredTile, setHoveredTile] = useState<{ x: number; z: number } | null>(null)
  const boardOffset = (boardSize - 1) / 2
  const selectedPiece = pieces.find(p => p.id === selectedId)

  // Track departing orbs so they can animate out in reverse order
  type LeavingMarker = { row: number; col: number; x: number; z: number; disappearDelay: number }
  const [leavingMarkers, setLeavingMarkers] = useState<LeavingMarker[]>([])
  const prevValidMoves = useRef<[number,number][]>([])
  const prevSelectedPiece = useRef<typeof pieces[0] | undefined>(undefined)
  const leavingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    const prev = prevValidMoves.current
    const prevPiece = prevSelectedPiece.current
    if (prev.length > 0) {
      const withDist = prev.map(([r, c]) => ({
        row: r, col: c,
        x: c - boardOffset, z: r - boardOffset,
        dist: prevPiece ? Math.max(Math.abs(r - prevPiece.row), Math.abs(c - prevPiece.col)) : 0,
      }))
      const maxDist = Math.max(...withDist.map(m => m.dist), 0)
      const leaving = withDist.map(m => ({
        row: m.row, col: m.col, x: m.x, z: m.z,
        disappearDelay: (maxDist - m.dist) * 0.028,
      }))
      setLeavingMarkers(leaving)
      if (leavingTimer.current) clearTimeout(leavingTimer.current)
      leavingTimer.current = setTimeout(
        () => setLeavingMarkers([]),
        (maxDist * 0.028 + 0.2) * 1000
      )
    }
    prevValidMoves.current = validMoves
    prevSelectedPiece.current = selectedPiece
  }, [validMoves])

  const tileGeometry = useMemo(() => {
    const r = CORNER_RADIUS
    const h = HALF - r
    const shape = new Shape()
    shape.moveTo(-h, -HALF)
    shape.lineTo(h, -HALF)
    shape.quadraticCurveTo(HALF, -HALF, HALF, -h)
    shape.lineTo(HALF, h)
    shape.quadraticCurveTo(HALF, HALF, h, HALF)
    shape.lineTo(-h, HALF)
    shape.quadraticCurveTo(-HALF, HALF, -HALF, h)
    shape.lineTo(-HALF, -h)
    shape.quadraticCurveTo(-HALF, -HALF, -h, -HALF)
    shape.closePath()

    return new ExtrudeGeometry(shape, {
      depth: TILE_HEIGHT,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 6,
      UVGenerator: uvGenerator,
    })
  }, [])

  const tileAssignment = useMemo(() => {
    const map: Record<string, number> = {}
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const rand = mulberry32(row * 100 + col + 7)
        map[`${row},${col}`] = 1 + Math.floor(rand() * TILE_COUNT)
      }
    }
    return map
  }, [boardSize])

  const tilePaths = Array.from({ length: TILE_COUNT }, (_, i) => `${import.meta.env.BASE_URL}textures/tile-${i + 1}.png`)
  const tileTextures = useTexture(tilePaths)
  tileTextures.forEach(t => { t.wrapS = t.wrapT = ClampToEdgeWrapping })

  const cornerTileTexture = useTexture(`${import.meta.env.BASE_URL}textures/tile-11.png`)

  const boardTexture = useTexture(`${import.meta.env.BASE_URL}textures/board-edge.png`)

  const overlays = useTexture({
    corner:   `${import.meta.env.BASE_URL}textures/tile-corner.png`,
    throne:   `${import.meta.env.BASE_URL}textures/tile-throne.png`,
    defender: `${import.meta.env.BASE_URL}textures/tile-defender.png`,
    attacker: `${import.meta.env.BASE_URL}textures/tile-attacker.png`,
  })

  const squares = useMemo(() => {
    const attackerSet = new Set(attackerStarts.map(([r, c]) => `${r},${c}`))
    const defenderSet = new Set(defenderStarts.map(([r, c]) => `${r},${c}`))
    const last = boardSize - 1
    const isEscapeSquare = (row: number, col: number) =>
      kingEscapeEdge
        ? (row === 0 || row === last || col === 0 || col === last)
        : isCorner(row, col, boardSize)
    const result = []
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const key = `${row},${col}`
        const x = col - boardOffset
        const z = row - boardOffset
        const variantIdx = (tileAssignment[key] ?? 1) - 1

        let overlay: 'corner' | 'throne' | 'defender' | 'attacker' | null = null
        if (isEscapeSquare(row, col)) overlay = 'corner'
        else if (isThrone(row, col, center)) overlay = 'throne'
        else if (defenderSet.has(key)) overlay = 'defender'
        else if (attackerSet.has(key)) overlay = 'attacker'

        result.push({ row, col, x, z, variantIdx, overlay, isCornerTile: isEscapeSquare(row, col) || isThrone(row, col, center) })
      }
    }
    return result
  }, [boardSize, boardOffset, center, attackerStarts, defenderStarts, tileAssignment, kingEscapeEdge])

  return (
    <group>
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[boardSize + 1.2, 0.3, boardSize + 1.2]} />
        <meshStandardMaterial
          map={boardTexture}
          roughness={theme.boardRoughness}
          metalness={theme.boardMetalness}
        />
      </mesh>

      {(() => {
        return squares.map(({ row, col, x, z, variantIdx, overlay, isCornerTile }) => {
        const validTarget = isValidMove(row, col, validMoves)
        const dist = selectedPiece
          ? Math.max(Math.abs(row - selectedPiece.row), Math.abs(col - selectedPiece.col))
          : 0
        const appearDelay = dist * 0.028
        return (
          <group
            key={`${row}-${col}`}
            position={[x, 0, z]}
            onClick={(e) => {
              e.stopPropagation()
              if (validTarget) movePiece(row, col)
              else if (selectedId) selectPiece(null)
            }}
          >
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              geometry={tileGeometry}
              receiveShadow
              onPointerEnter={(e) => { e.stopPropagation(); if (!powerSaving) setHoveredTile({ x, z }) }}
              onPointerLeave={(e) => { e.stopPropagation(); setHoveredTile(null) }}
            >
              <meshStandardMaterial
                map={isCornerTile ? cornerTileTexture : tileTextures[variantIdx]}
                roughness={theme.boardRoughness}
                metalness={theme.boardMetalness}
              />
            </mesh>

            {overlay && (
              <mesh position={[0, TILE_TOP + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[SQUARE_SIZE * 0.96, SQUARE_SIZE * 0.96]} />
                <meshStandardMaterial
                  map={overlays[overlay]}
                  transparent
                  alphaTest={0.1}
                  roughness={0.8}
                  metalness={0}
                  depthWrite={false}
                  polygonOffset
                  polygonOffsetFactor={-1}
                />
              </mesh>
            )}

            {validTarget && <ValidMoveMarker x={0} z={0} row={row} col={col} appearDelay={appearDelay} />}
          </group>
        )
      })
      })()}

      {!powerSaving && (
        <TileHoverGlow
          x={hoveredTile?.x ?? 0}
          z={hoveredTile?.z ?? 0}
          active={hoveredTile !== null}
        />
      )}

      {/* Departing orbs — animate out in reverse order */}
      {leavingMarkers.map(m => (
        <ValidMoveMarker
          key={`leaving-${m.row}-${m.col}`}
          x={m.x} z={m.z} row={m.row} col={m.col}
          appearDelay={0}
          disappearing
          disappearDelay={m.disappearDelay}
        />
      ))}
    </group>
  )
}
