import { useMemo } from 'react'
import { useTexture, RoundedBox } from '@react-three/drei'
import { RepeatWrapping } from 'three'
import { BOARD_SIZE, isCorner, isThrone, attackerStarts, defenderStarts } from '../../game/hnefatafl'
import type { ThemeConfig } from '../../lib/themes'

const SQUARE_SIZE = 0.88
const TILE_HEIGHT = 0.12
const BEVEL = 0.04
const BOARD_OFFSET = (BOARD_SIZE - 1) / 2
const TILE_COUNT = 10

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

interface BoardProps {
  theme: ThemeConfig
}

export function Board({ theme }: BoardProps) {
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

  const tilePaths = Array.from({ length: TILE_COUNT }, (_, i) => `/textures/tile-${i + 1}.png`)
  const tileTextures = useTexture(tilePaths)

  const overlays = useTexture({
    corner:   '/textures/tile-corner.png',
    throne:   '/textures/tile-throne.png',
    defender: '/textures/tile-defender.png',
    attacker: '/textures/tile-attacker.png',
  })

  ;[...tileTextures, ...Object.values(overlays)].forEach(t => {
    t.wrapS = t.wrapT = RepeatWrapping
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
          color={theme.boardEdgeColor}
          roughness={theme.boardRoughness}
          metalness={theme.boardMetalness}
        />
      </mesh>

      {squares.map(({ row, col, x, z, variantIdx, overlay }) => (
        <group key={`${row}-${col}`} position={[x, 0, z]}>
          <RoundedBox
            args={[SQUARE_SIZE, TILE_HEIGHT, SQUARE_SIZE]}
            radius={BEVEL}
            smoothness={4}
            receiveShadow
          >
            <meshStandardMaterial
              map={tileTextures[variantIdx]}
              roughness={theme.boardRoughness}
              metalness={theme.boardMetalness}
            />
          </RoundedBox>

          {overlay && (
            <mesh position={[0, TILE_HEIGHT / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[SQUARE_SIZE * 0.88, SQUARE_SIZE * 0.88]} />
              <meshStandardMaterial
                map={overlays[overlay]}
                transparent
                alphaTest={0.05}
                roughness={0.8}
                metalness={0}
                depthWrite={false}
              />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}
