import { useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { ClampToEdgeWrapping, Shape, ExtrudeGeometry, Vector2, MeshStandardMaterial } from 'three'
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

function ValidMoveMarker({ x, z, row, col }: { x: number; z: number; row: number; col: number }) {
  const matRef = useRef<MeshStandardMaterial>(null)
  const { movePiece, powerSaving } = useGameStore()
  useFrame(({ clock }) => {
    if (matRef.current && !powerSaving) {
      matRef.current.opacity = 0.25 + 0.15 * Math.sin(clock.elapsedTime * 3)
    }
  })
  return (
    <mesh
      position={[x, TILE_TOP + 0.005, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => { e.stopPropagation(); movePiece(row, col) }}
    >
      <planeGeometry args={[SQUARE_SIZE * 0.82, SQUARE_SIZE * 0.82]} />
      <meshStandardMaterial
        ref={matRef}
        color="#e8c040"
        emissive="#e8c040"
        emissiveIntensity={1.2}
        transparent
        opacity={0.3}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  )
}

export function Board({ theme }: BoardProps) {
  const { rules, validMoves, selectedId, selectPiece } = useGameStore()
  const { boardSize, center, attackerStarts, defenderStarts } = getBoardConfig(rules)
  const boardOffset = (boardSize - 1) / 2

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
    const result = []
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const key = `${row},${col}`
        const x = col - boardOffset
        const z = row - boardOffset
        const variantIdx = (tileAssignment[key] ?? 1) - 1

        let overlay: 'corner' | 'throne' | 'defender' | 'attacker' | null = null
        if (isCorner(row, col, boardSize)) overlay = 'corner'
        else if (isThrone(row, col, center)) overlay = 'throne'
        else if (defenderSet.has(key)) overlay = 'defender'
        else if (attackerSet.has(key)) overlay = 'attacker'

        result.push({ row, col, x, z, variantIdx, overlay, isCornerTile: isCorner(row, col, boardSize) || isThrone(row, col, center) })
      }
    }
    return result
  }, [boardSize, boardOffset, center, attackerStarts, defenderStarts, tileAssignment])

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

      {squares.map(({ row, col, x, z, variantIdx, overlay, isCornerTile }) => {
        const validTarget = isValidMove(row, col, validMoves)
        return (
          <group
            key={`${row}-${col}`}
            position={[x, 0, z]}
            onClick={(e) => {
              e.stopPropagation()
              if (!validTarget && selectedId) selectPiece(null)
            }}
          >
            <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={tileGeometry} receiveShadow>
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

            {validTarget && <ValidMoveMarker x={0} z={0} row={row} col={col} />}
          </group>
        )
      })}
    </group>
  )
}
