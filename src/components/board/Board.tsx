import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { ClampToEdgeWrapping, Shape, ExtrudeGeometry, Vector2 } from 'three'
import { BOARD_SIZE, isCorner, isThrone, attackerStarts, defenderStarts } from '../../game/hnefatafl'
import type { ThemeConfig } from '../../lib/themes'

const SQUARE_SIZE = 0.88
const TILE_HEIGHT = 0.055
const CORNER_RADIUS = 0.05
const BEVEL = 0.038
const TILE_TOP = TILE_HEIGHT + BEVEL
const BOARD_OFFSET = (BOARD_SIZE - 1) / 2
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

const attackerSet = new Set(attackerStarts.map(([r, c]) => `${r},${c}`))
const defenderSet = new Set(defenderStarts.map(([r, c]) => `${r},${c}`))

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

export function Board({ theme }: BoardProps) {
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
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const rand = mulberry32(row * 100 + col + 7)
        map[`${row},${col}`] = 1 + Math.floor(rand() * TILE_COUNT)
      }
    }
    return map
  }, [])

  const tilePaths = Array.from({ length: TILE_COUNT }, (_, i) => `${import.meta.env.BASE_URL}textures/tile-${i + 1}.png`)
  const tileTextures = useTexture(tilePaths)
  tileTextures.forEach(t => { t.wrapS = t.wrapT = ClampToEdgeWrapping })

  const boardTexture = useTexture(`${import.meta.env.BASE_URL}textures/board-edge.png`)

  const overlays = useTexture({
    corner:   `${import.meta.env.BASE_URL}textures/tile-corner.png`,
    throne:   `${import.meta.env.BASE_URL}textures/tile-throne.png`,
    defender: `${import.meta.env.BASE_URL}textures/tile-defender.png`,
    attacker: `${import.meta.env.BASE_URL}textures/tile-attacker.png`,
  })

  const squares = useMemo(() => {
    const result = []
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const key = `${row},${col}`
        const x = col - BOARD_OFFSET
        const z = row - BOARD_OFFSET
        const variantIdx = (tileAssignment[key] ?? 1) - 1

        let overlay: 'corner' | 'throne' | 'defender' | 'attacker' | null = null
        if (isCorner(row, col)) overlay = 'corner'
        else if (isThrone(row, col)) overlay = 'throne'
        else if (defenderSet.has(key)) overlay = 'defender'
        else if (attackerSet.has(key)) overlay = 'attacker'

        result.push({ row, col, x, z, variantIdx, overlay })
      }
    }
    return result
  }, [tileAssignment])

  return (
    <group>
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[BOARD_SIZE + 1.2, 0.3, BOARD_SIZE + 1.2]} />
        <meshStandardMaterial
          map={boardTexture}
          roughness={theme.boardRoughness}
          metalness={theme.boardMetalness}
        />
      </mesh>

      {squares.map(({ row, col, x, z, variantIdx, overlay }) => (
        <group key={`${row}-${col}`} position={[x, 0, z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={tileGeometry} receiveShadow>
            <meshStandardMaterial
              map={tileTextures[variantIdx]}
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
        </group>
      ))}
    </group>
  )
}
